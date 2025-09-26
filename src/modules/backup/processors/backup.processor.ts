import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { BackupService } from '../backup.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BackupType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Processor('backup-jobs')
export class BackupProcessor {
  private readonly logger = new Logger(BackupProcessor.name);

  constructor(
    private backupService: BackupService,
    private prisma: PrismaService,
  ) {}

  @Process('create-backup')
  async handleCreateBackup(job: Job<{ backupId: string; serverId: string; userId: string }>) {
    const { backupId, serverId, userId } = job.data;
    this.logger.log(`Processing create-backup job: ${backupId}`);

    try {
      await this.backupService.createBackupFile(backupId);
      this.logger.log(`Create-backup job completed: ${backupId}`);
    } catch (error) {
      this.logger.error(`Create-backup job failed: ${backupId}`, error);
      throw error;
    }
  }

  @Process('restore-backup')
  async handleRestoreBackup(job: Job<{ backupId: string; serverId: string; userId: string }>) {
    const { backupId, serverId, userId } = job.data;
    this.logger.log(`Processing restore-backup job: ${backupId} -> ${serverId}`);

    try {
      await this.backupService.restoreBackupFile(backupId, serverId);
      this.logger.log(`Restore-backup job completed: ${backupId} -> ${serverId}`);
    } catch (error) {
      this.logger.error(`Restore-backup job failed: ${backupId} -> ${serverId}`, error);
      throw error;
    }
  }

  @Process('auto-backup')
  async handleAutoBackup(job: Job<{ serverId: string }>) {
    const { serverId } = job.data;
    this.logger.log(`Processing auto-backup job for server: ${serverId}`);

    try {
      const server = await this.prisma.gameServer.findUnique({
        where: { id: serverId },
      });

      if (!server) {
        this.logger.warn(`Server not found for auto-backup: ${serverId}`);
        return;
      }

      // Create auto backup record
      const backup = await this.prisma.serverBackup.create({
        data: {
          id: uuidv4(),
          name: `Auto Backup - ${new Date().toLocaleDateString()}`,
          description: 'Automatically created backup',
          gameServerId: serverId,
          userId: server.userId,
          backupType: BackupType.SCHEDULED,
          filePath: '',
          fileSize: BigInt(0),
        },
      });

      // Create the backup file
      await this.backupService.createBackupFile(backup.id);

      // Clean up old auto backups (keep last 7)
      const oldBackups = await this.prisma.serverBackup.findMany({
        where: {
          gameServerId: serverId,
          backupType: BackupType.SCHEDULED,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: 7, // Keep the 7 most recent
      });

      for (const oldBackup of oldBackups) {
        await this.backupService.deleteBackup(server.userId, oldBackup.id);
      }

      this.logger.log(`Auto-backup job completed for server: ${serverId}`);
    } catch (error) {
      this.logger.error(`Auto-backup job failed for server: ${serverId}`, error);
      throw error;
    }
  }
}