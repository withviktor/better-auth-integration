import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService, ContainerConfig } from '../docker/docker.service';
import { GameServer, ServerStatus, ServerTemplate, User } from '@prisma/client';
import * as fs from 'fs-extra';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface CreateServerDto {
  name: string;
  description?: string;
  gameType: string;
  version: string;
  templateId?: string;
  maxPlayers?: number;
  config?: any;
}

export interface UpdateServerDto {
  name?: string;
  description?: string;
  maxPlayers?: number;
  config?: any;
}

export interface ServerWithDetails extends GameServer {
  template?: ServerTemplate;
  user: User;
}

@Injectable()
export class GameServerService {
  private readonly logger = new Logger(GameServerService.name);
  private readonly baseServerPath = process.env.GAME_SERVERS_PATH || '/app/game_servers';

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
    @InjectQueue('server-jobs') private serverQueue: Queue,
  ) {}

  /**
   * Create a new game server
   */
  async createServer(userId: string, createDto: CreateServerDto): Promise<GameServer> {
    this.logger.log(`Creating server for user ${userId}: ${createDto.name}`);

    // Check user's server limit
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { gameServers: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.gameServers.length >= user.maxServers) {
      throw new BadRequestException(`Server limit reached (${user.maxServers})`);
    }

    // Get template if specified
    let template: ServerTemplate | null = null;
    if (createDto.templateId) {
      template = await this.prisma.serverTemplate.findUnique({
        where: { id: createDto.templateId },
      });

      if (!template) {
        throw new NotFoundException('Template not found');
      }

      if (!template.isPublic && template.userId !== userId) {
        throw new ForbiddenException('Template not accessible');
      }
    }

    // Find available port
    const port = await this.findAvailablePort();

    // Create server record
    const server = await this.prisma.gameServer.create({
      data: {
        id: uuidv4(),
        name: createDto.name,
        description: createDto.description,
        gameType: createDto.gameType,
        version: createDto.version,
        port,
        maxPlayers: createDto.maxPlayers || 20,
        userId,
        templateId: template?.id,
        config: createDto.config || template?.defaultConfig || {},
        environment: template?.environment || {},
        imageName: template?.dockerImage || this.getDefaultImage(createDto.gameType, createDto.version),
        status: ServerStatus.INSTALLING,
        serverPath: path.join(this.baseServerPath, uuidv4()),
      },
    });

    // Queue server installation
    await this.serverQueue.add('install-server', {
      serverId: server.id,
      userId,
    });

    this.logger.log(`Server created: ${server.id}`);
    return server;
  }

  /**
   * Get server by ID
   */
  async getServer(serverId: string, userId?: string): Promise<ServerWithDetails> {
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
      include: {
        template: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    // Check ownership if userId provided
    if (userId && server.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return server as ServerWithDetails;
  }

  /**
   * Get all servers for a user
   */
  async getUserServers(userId: string): Promise<ServerWithDetails[]> {
    return this.prisma.gameServer.findMany({
      where: { userId },
      include: {
        template: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }) as Promise<ServerWithDetails[]>;
  }

  /**
   * Update server configuration
   */
  async updateServer(serverId: string, userId: string, updateDto: UpdateServerDto): Promise<GameServer> {
    const server = await this.getServer(serverId, userId);

    const updatedServer = await this.prisma.gameServer.update({
      where: { id: serverId },
      data: {
        ...updateDto,
        updatedAt: new Date(),
      },
    });

    this.logger.log(`Server updated: ${serverId}`);
    return updatedServer;
  }

  /**
   * Start a server
   */
  async startServer(serverId: string, userId: string): Promise<void> {
    const server = await this.getServer(serverId, userId);

    if (server.status === ServerStatus.RUNNING) {
      throw new BadRequestException('Server is already running');
    }

    if (server.status === ServerStatus.STARTING) {
      throw new BadRequestException('Server is already starting');
    }

    // Update status
    await this.updateServerStatus(serverId, ServerStatus.STARTING);

    // Queue start job
    await this.serverQueue.add('start-server', {
      serverId,
      userId,
    });

    this.logger.log(`Server start queued: ${serverId}`);
  }

  /**
   * Stop a server
   */
  async stopServer(serverId: string, userId: string): Promise<void> {
    const server = await this.getServer(serverId, userId);

    if (server.status === ServerStatus.STOPPED) {
      throw new BadRequestException('Server is already stopped');
    }

    if (server.status === ServerStatus.STOPPING) {
      throw new BadRequestException('Server is already stopping');
    }

    // Update status
    await this.updateServerStatus(serverId, ServerStatus.STOPPING);

    // Queue stop job
    await this.serverQueue.add('stop-server', {
      serverId,
      userId,
    });

    this.logger.log(`Server stop queued: ${serverId}`);
  }

  /**
   * Restart a server
   */
  async restartServer(serverId: string, userId: string): Promise<void> {
    const server = await this.getServer(serverId, userId);

    // Update status
    await this.updateServerStatus(serverId, ServerStatus.STOPPING);

    // Queue restart job
    await this.serverQueue.add('restart-server', {
      serverId,
      userId,
    });

    this.logger.log(`Server restart queued: ${serverId}`);
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: string, userId: string): Promise<void> {
    const server = await this.getServer(serverId, userId);

    // Stop server first if running
    if (server.status === ServerStatus.RUNNING) {
      await this.stopServer(serverId, userId);
      // Wait for server to stop before deletion
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Queue deletion job
    await this.serverQueue.add('delete-server', {
      serverId,
      userId,
    });

    this.logger.log(`Server deletion queued: ${serverId}`);
  }

  /**
   * Get server logs
   */
  async getServerLogs(serverId: string, userId: string, tail = 100): Promise<string> {
    const server = await this.getServer(serverId, userId);

    if (!server.containerId) {
      // Get logs from database if container doesn't exist
      const logs = await this.prisma.serverLog.findMany({
        where: { gameServerId: serverId },
        orderBy: { createdAt: 'desc' },
        take: tail,
      });

      return logs.map(log => `[${log.createdAt.toISOString()}] [${log.level}] ${log.message}`).join('\n');
    }

    return this.dockerService.getContainerLogs(server.containerId, tail);
  }

  /**
   * Execute command in server
   */
  async executeCommand(serverId: string, userId: string, command: string): Promise<string> {
    const server = await this.getServer(serverId, userId);

    if (!server.containerId || server.status !== ServerStatus.RUNNING) {
      throw new BadRequestException('Server is not running');
    }

    return this.dockerService.execInContainer(server.containerId, ['sh', '-c', command]);
  }

  /**
   * Get server statistics
   */
  async getServerStats(serverId: string, userId: string): Promise<any> {
    const server = await this.getServer(serverId, userId);

    if (!server.containerId) {
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        memoryLimit: 0,
        networkRx: 0,
        networkTx: 0,
        status: server.status,
      };
    }

    const stats = await this.dockerService.getContainerStats(server.containerId);
    return {
      ...stats,
      status: server.status,
    };
  }

  /**
   * Install server (called by job processor)
   */
  async installServer(serverId: string): Promise<void> {
    this.logger.log(`Installing server: ${serverId}`);

    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
      include: { template: true },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    try {
      // Create server directory
      await fs.ensureDir(server.serverPath);

      // Create Docker container configuration
      const containerConfig: ContainerConfig = {
        name: `gameserver-${serverId}`,
        image: server.imageName,
        ports: {
          [`${server.port}/tcp`]: { HostPort: server.port.toString() },
        },
        environment: this.buildEnvironmentVariables(server),
        volumes: [
          `${server.serverPath}:/server`,
        ],
        memoryLimit: server.template?.maxMemory ? server.template.maxMemory * 1024 * 1024 : undefined,
        cpuLimit: server.template?.maxCpu ? server.template.maxCpu * 100000 : undefined,
      };

      // Create container
      const containerId = await this.dockerService.createContainer(containerConfig);

      // Update server with container ID
      await this.prisma.gameServer.update({
        where: { id: serverId },
        data: {
          containerId,
          status: ServerStatus.STOPPED,
        },
      });

      this.logger.log(`Server installed successfully: ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to install server ${serverId}`, error);
      await this.updateServerStatus(serverId, ServerStatus.CRASHED);
      throw error;
    }
  }

  /**
   * Start server container (called by job processor)
   */
  async startServerContainer(serverId: string): Promise<void> {
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server || !server.containerId) {
      throw new NotFoundException('Server or container not found');
    }

    try {
      await this.dockerService.startContainer(server.containerId);
      
      await this.prisma.gameServer.update({
        where: { id: serverId },
        data: {
          status: ServerStatus.RUNNING,
          lastStarted: new Date(),
        },
      });

      this.logger.log(`Server started successfully: ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to start server ${serverId}`, error);
      await this.updateServerStatus(serverId, ServerStatus.CRASHED);
      throw error;
    }
  }

  /**
   * Stop server container (called by job processor)
   */
  async stopServerContainer(serverId: string): Promise<void> {
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server || !server.containerId) {
      throw new NotFoundException('Server or container not found');
    }

    try {
      await this.dockerService.stopContainer(server.containerId);
      
      await this.prisma.gameServer.update({
        where: { id: serverId },
        data: {
          status: ServerStatus.STOPPED,
          lastStopped: new Date(),
        },
      });

      this.logger.log(`Server stopped successfully: ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to stop server ${serverId}`, error);
      await this.updateServerStatus(serverId, ServerStatus.CRASHED);
      throw error;
    }
  }

  /**
   * Delete server and cleanup (called by job processor)
   */
  async deleteServerContainer(serverId: string): Promise<void> {
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    try {
      // Remove Docker container if it exists
      if (server.containerId) {
        try {
          await this.dockerService.removeContainer(server.containerId, true);
        } catch (error) {
          this.logger.warn(`Failed to remove container ${server.containerId}`, error);
        }
      }

      // Remove server files
      if (server.serverPath && await fs.pathExists(server.serverPath)) {
        await fs.remove(server.serverPath);
      }

      // Delete server record
      await this.prisma.gameServer.delete({
        where: { id: serverId },
      });

      this.logger.log(`Server deleted successfully: ${serverId}`);
    } catch (error) {
      this.logger.error(`Failed to delete server ${serverId}`, error);
      throw error;
    }
  }

  /**
   * Update server status
   */
  private async updateServerStatus(serverId: string, status: ServerStatus): Promise<void> {
    await this.prisma.gameServer.update({
      where: { id: serverId },
      data: { status },
    });
  }

  /**
   * Find an available port for the server
   */
  private async findAvailablePort(): Promise<number> {
    const startPort = 25565; // Default Minecraft port
    const maxPort = 30000;

    for (let port = startPort; port <= maxPort; port++) {
      const existingServer = await this.prisma.gameServer.findFirst({
        where: { port },
      });

      if (!existingServer) {
        return port;
      }
    }

    throw new BadRequestException('No available ports');
  }

  /**
   * Get default Docker image for game type
   */
  private getDefaultImage(gameType: string, version: string): string {
    const imageMap = {
      minecraft: `itzg/minecraft-server:${version}`,
      'minecraft-bedrock': `itzg/minecraft-bedrock-server:${version}`,
      valheim: `lloesche/valheim-server:${version}`,
      terraria: `ryshe/terraria:${version}`,
    };

    return imageMap[gameType] || `${gameType}:${version}`;
  }

  /**
   * Build environment variables for container
   */
  private buildEnvironmentVariables(server: GameServer): string[] {
    const env = [
      'EULA=TRUE',
      `SERVER_NAME=${server.name}`,
      `MAX_PLAYERS=${server.maxPlayers}`,
    ];

    // Add custom environment variables
    if (server.environment) {
      Object.entries(server.environment as any).forEach(([key, value]) => {
        env.push(`${key}=${value}`);
      });
    }

    // Add config-specific environment variables
    if (server.config) {
      const config = server.config as any;
      if (config.difficulty) env.push(`DIFFICULTY=${config.difficulty}`);
      if (config.gamemode) env.push(`MODE=${config.gamemode}`);
      if (config.seed) env.push(`SEED=${config.seed}`);
      if (config.motd) env.push(`MOTD=${config.motd}`);
    }

    return env;
  }
}