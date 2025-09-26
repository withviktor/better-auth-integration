import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { ServerBackup, BackupType } from '@prisma/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as archiver from 'archiver';
import * as tar from 'tar';
import { v4 as uuidv4 } from 'uuid';

export interface CreateBackupDto {
  name: string;
  description?: string;
  serverId: string;
}

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);
  private readonly backupPath = process.env.BACKUP_PATH || '/app/backups';

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
    @InjectQueue('backup-jobs') private backupQueue: Queue,
  ) {
    // Ensure backup directory exists
    fs.ensureDirSync(this.backupPath);
  }

  /**
   * Create a manual backup
   */
  async createBackup(userId: string, createDto: CreateBackupDto): Promise<ServerBackup> {
    // Verify server ownership
    const server = await this.prisma.gameServer.findUnique({
      where: { id: createDto.serverId },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (server.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    // Create backup record
    const backup = await this.prisma.serverBackup.create({
      data: {
        id: uuidv4(),
        name: createDto.name,
        description: createDto.description,
        gameServerId: createDto.serverId,
        userId,
        backupType: BackupType.MANUAL,
        filePath: '', // Will be set after backup is created
        fileSize: BigInt(0), // Will be set after backup is created
      },
    });

    // Queue backup job
    await this.backupQueue.add('create-backup', {
      backupId: backup.id,
      serverId: createDto.serverId,
      userId,
    });

    this.logger.log(`Backup job queued: ${backup.id}`);
    return backup;
  }

  /**
   * Get user's backups for a server
   */
  async getServerBackups(userId: string, serverId: string): Promise<ServerBackup[]> {
    // Verify server ownership
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    if (server.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.prisma.serverBackup.findMany({
      where: {
        gameServerId: serverId,
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get all user's backups
   */
  async getUserBackups(userId: string): Promise<ServerBackup[]> {
    return this.prisma.serverBackup.findMany({
      where: { userId },
      include: {
        gameServer: {
          select: {
            id: true,
            name: true,
            gameType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Get backup by ID
   */
  async getBackup(userId: string, backupId: string): Promise<ServerBackup> {
    const backup = await this.prisma.serverBackup.findUnique({
      where: { id: backupId },
      include: {
        gameServer: true,
      },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    if (backup.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return backup;
  }

  /**
   * Delete backup
   */
  async deleteBackup(userId: string, backupId: string): Promise<void> {
    const backup = await this.getBackup(userId, backupId);

    // Delete backup file
    if (backup.filePath && await fs.pathExists(backup.filePath)) {
      await fs.remove(backup.filePath);
    }

    // Delete backup record
    await this.prisma.serverBackup.delete({
      where: { id: backupId },
    });

    this.logger.log(`Backup deleted: ${backupId}`);
  }

  /**
   * Restore backup to server
   */
  async restoreBackup(userId: string, backupId: string, targetServerId?: string): Promise<void> {
    const backup = await this.getBackup(userId, backupId);
    const serverId = targetServerId || backup.gameServerId;

    // Verify target server ownership
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundException('Target server not found');
    }

    if (server.userId !== userId) {
      throw new ForbiddenException('Access denied to target server');
    }

    // Queue restore job
    await this.backupQueue.add('restore-backup', {
      backupId,
      serverId,
      userId,
    });

    this.logger.log(`Backup restore job queued: ${backupId} -> ${serverId}`);
  }

  /**
   * Create backup file (called by processor)
   */
  async createBackupFile(backupId: string): Promise<void> {
    const backup = await this.prisma.serverBackup.findUnique({
      where: { id: backupId },
      include: { gameServer: true },
    });

    if (!backup) {
      throw new NotFoundException('Backup not found');
    }

    const server = backup.gameServer;
    if (!server.serverPath) {
      throw new BadRequestException('Server path not found');
    }

    try {
      // Create backup filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${server.name}-${timestamp}.tar.gz`;
      const backupFilePath = path.join(this.backupPath, filename);

      // Create compressed backup
      if (server.containerId && server.status === 'RUNNING') {
        // Backup from running container
        await this.dockerService.createVolumeBackup(server.containerId, backupFilePath);
      } else {
        // Backup from file system
        await this.createFileSystemBackup(server.serverPath, backupFilePath);
      }

      // Get file size
      const stats = await fs.stat(backupFilePath);
      const fileSize = BigInt(stats.size);

      // Update backup record
      await this.prisma.serverBackup.update({
        where: { id: backupId },
        data: {
          filePath: backupFilePath,
          fileSize,
        },
      });

      this.logger.log(`Backup created successfully: ${backupFilePath}`);
    } catch (error) {
      this.logger.error(`Failed to create backup ${backupId}`, error);
      
      // Update backup record with error
      await this.prisma.serverBackup.delete({
        where: { id: backupId },
      });
      
      throw error;
    }
  }

  /**
   * Restore backup file (called by processor)
   */
  async restoreBackupFile(backupId: string, serverId: string): Promise<void> {
    const backup = await this.prisma.serverBackup.findUnique({
      where: { id: backupId },
    });

    if (!backup || !backup.filePath) {
      throw new NotFoundException('Backup file not found');
    }

    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server || !server.serverPath) {
      throw new NotFoundException('Server not found');
    }

    try {
      // Stop server if running
      const wasRunning = server.status === 'RUNNING';
      if (wasRunning && server.containerId) {
        await this.dockerService.stopContainer(server.containerId);
      }

      // Clear existing server files
      await fs.emptyDir(server.serverPath);

      if (server.containerId) {
        // Restore to container
        await this.dockerService.restoreVolumeBackup(server.containerId, backup.filePath);
      } else {
        // Restore to file system
        await this.restoreFileSystemBackup(backup.filePath, server.serverPath);
      }

      // Restart server if it was running
      if (wasRunning && server.containerId) {
        await this.dockerService.startContainer(server.containerId);
      }

      this.logger.log(`Backup restored successfully: ${backupId} -> ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to restore backup ${backupId}`, error);
      throw error;
    }
  }

  /**
   * Schedule automatic backup
   */
  async scheduleAutoBackup(serverId: string): Promise<void> {
    await this.backupQueue.add(
      'auto-backup',
      { serverId },
      {
        repeat: { cron: '0 2 * * *' }, // Daily at 2 AM
        jobId: `auto-backup-${serverId}`,
      },
    );

    this.logger.log(`Auto backup scheduled for server: ${serverId}`);
  }

  /**
   * Cancel scheduled backup
   */
  async cancelAutoBackup(serverId: string): Promise<void> {
    await this.backupQueue.removeRepeatable('auto-backup', {
      cron: '0 2 * * *',
      jobId: `auto-backup-${serverId}`,
    });

    this.logger.log(`Auto backup cancelled for server: ${serverId}`);
  }

  /**
   * Create file system backup
   */
  private async createFileSystemBackup(sourcePath: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(targetPath);
      const archive = archiver('tar', {
        gzip: true,
        gzipOptions: { level: 6 },
      });

      output.on('close', resolve);
      output.on('error', reject);
      archive.on('error', reject);

      archive.pipe(output);
      archive.directory(sourcePath, false);
      archive.finalize();
    });
  }

  /**
   * Restore file system backup
   */
  private async restoreFileSystemBackup(backupPath: string, targetPath: string): Promise<void> {
    await tar.extract({
      file: backupPath,
      cwd: targetPath,
    });
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(userId: string): Promise<any> {
    const [totalBackups, totalSize, recentBackups] = await Promise.all([
      this.prisma.serverBackup.count({
        where: { userId },
      }),
      this.prisma.serverBackup.aggregate({
        where: { userId },
        _sum: { fileSize: true },
      }),
      this.prisma.serverBackup.count({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
      }),
    ]);

    return {
      totalBackups,
      totalSize: totalSize._sum.fileSize || BigInt(0),
      recentBackups,
    };
  }
}