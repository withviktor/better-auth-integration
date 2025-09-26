import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DockerService } from '../docker/docker.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { ServerStatus } from '@prisma/client';

@Injectable()
export class MonitoringService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringService.name);
  private monitoringActive = false;

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
    private websocketGateway: WebsocketGateway,
  ) {}

  async onModuleInit() {
    this.logger.log('Monitoring service initialized');
    this.monitoringActive = true;
  }

  /**
   * Monitor all running servers every 30 seconds
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async monitorServers() {
    if (!this.monitoringActive) return;

    try {
      const runningServers = await this.prisma.gameServer.findMany({
        where: {
          status: {
            in: [ServerStatus.RUNNING, ServerStatus.STARTING],
          },
          containerId: {
            not: null,
          },
        },
      });

      for (const server of runningServers) {
        await this.monitorServer(server.id);
      }
    } catch (error) {
      this.logger.error('Error during server monitoring cycle', error);
    }
  }

  /**
   * Monitor a specific server
   */
  async monitorServer(serverId: string): Promise<void> {
    try {
      const server = await this.prisma.gameServer.findUnique({
        where: { id: serverId },
      });

      if (!server || !server.containerId) {
        return;
      }

      // Get container status
      const containerStatus = await this.dockerService.getContainerStatus(server.containerId);
      
      // Map Docker status to our server status
      const serverStatus = this.mapContainerStatusToServerStatus(containerStatus);

      // Update server status if it changed
      if (serverStatus !== server.status) {
        await this.updateServerStatus(serverId, serverStatus);
        
        // Emit status update via WebSocket
        this.websocketGateway.emitServerStatusUpdate(serverId, serverStatus, {
          previousStatus: server.status,
        });
      }

      // Get and store metrics if server is running
      if (serverStatus === ServerStatus.RUNNING) {
        const stats = await this.dockerService.getContainerStats(server.containerId);
        
        // Store metrics in database
        await this.storeServerMetrics(serverId, stats);

        // Update server with current usage
        await this.prisma.gameServer.update({
          where: { id: serverId },
          data: {
            cpuUsage: stats.cpuUsage,
            memoryUsage: (stats.memoryUsage / stats.memoryLimit) * 100,
            diskUsage: 0, // TODO: Implement disk usage monitoring
          },
        });

        // Emit metrics via WebSocket
        this.websocketGateway.emitServerMetrics(serverId, {
          cpuUsage: stats.cpuUsage,
          memoryUsage: stats.memoryUsage,
          memoryLimit: stats.memoryLimit,
          networkRx: stats.networkRx,
          networkTx: stats.networkTx,
        });
      }

    } catch (error) {
      this.logger.error(`Error monitoring server ${serverId}`, error);
      
      // If we can't monitor the server, mark it as crashed
      await this.updateServerStatus(serverId, ServerStatus.CRASHED);
      this.websocketGateway.emitServerStatusUpdate(serverId, ServerStatus.CRASHED, {
        error: 'Monitoring failed',
      });
    }
  }

  /**
   * Get server metrics history
   */
  async getServerMetrics(serverId: string, hours = 24): Promise<any[]> {
    const since = new Date();
    since.setHours(since.getHours() - hours);

    return this.prisma.serverMetric.findMany({
      where: {
        gameServerId: serverId,
        createdAt: {
          gte: since,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /**
   * Get system overview
   */
  async getSystemOverview(): Promise<any> {
    const [
      totalServers,
      runningServers,
      stoppedServers,
      crashedServers,
      totalUsers,
      dockerInfo,
    ] = await Promise.all([
      this.prisma.gameServer.count(),
      this.prisma.gameServer.count({ where: { status: ServerStatus.RUNNING } }),
      this.prisma.gameServer.count({ where: { status: ServerStatus.STOPPED } }),
      this.prisma.gameServer.count({ where: { status: ServerStatus.CRASHED } }),
      this.prisma.user.count(),
      this.dockerService.getSystemInfo(),
    ]);

    return {
      servers: {
        total: totalServers,
        running: runningServers,
        stopped: stoppedServers,
        crashed: crashedServers,
      },
      users: {
        total: totalUsers,
      },
      system: {
        docker: dockerInfo ? {
          version: dockerInfo.ServerVersion,
          containers: dockerInfo.Containers,
          images: dockerInfo.Images,
          memoryLimit: dockerInfo.MemTotal,
          cpus: dockerInfo.NCPU,
        } : null,
      },
      websocket: {
        connectedUsers: this.websocketGateway.getConnectedUsersCount(),
      },
    };
  }

  /**
   * Get server uptime statistics
   */
  async getServerUptime(serverId: string, days = 30): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
      select: {
        createdAt: true,
        lastStarted: true,
        lastStopped: true,
      },
    });

    if (!server) {
      return null;
    }

    // Calculate uptime percentage
    // This is a simplified calculation - in production, you'd want more detailed tracking
    const totalTime = Date.now() - Math.max(server.createdAt.getTime(), since.getTime());
    const uptimePercentage = 85; // Placeholder - implement proper uptime calculation

    return {
      uptimePercentage,
      lastStarted: server.lastStarted,
      lastStopped: server.lastStopped,
      totalTime,
    };
  }

  /**
   * Check server health
   */
  async checkServerHealth(serverId: string): Promise<any> {
    const server = await this.prisma.gameServer.findUnique({
      where: { id: serverId },
    });

    if (!server || !server.containerId) {
      return {
        healthy: false,
        reason: 'Server not found or no container',
      };
    }

    try {
      const status = await this.dockerService.getContainerStatus(server.containerId);
      const stats = await this.dockerService.getContainerStats(server.containerId);

      const healthy = status === 'running' && stats.cpuUsage < 95 && (stats.memoryUsage / stats.memoryLimit) < 0.95;

      return {
        healthy,
        status,
        cpuUsage: stats.cpuUsage,
        memoryUsage: stats.memoryUsage,
        memoryLimit: stats.memoryLimit,
        reason: healthy ? 'Server is healthy' : 'Server is experiencing issues',
      };
    } catch (error) {
      return {
        healthy: false,
        reason: 'Failed to check server health',
        error: error.message,
      };
    }
  }

  /**
   * Store server metrics in database
   */
  private async storeServerMetrics(serverId: string, stats: any): Promise<void> {
    try {
      await this.prisma.serverMetric.create({
        data: {
          gameServerId: serverId,
          cpuUsage: stats.cpuUsage,
          memoryUsage: stats.memoryUsage,
          diskUsage: 0, // TODO: Implement disk usage
          networkIn: stats.networkRx,
          networkOut: stats.networkTx,
          playerCount: 0, // TODO: Implement player count monitoring
        },
      });
    } catch (error) {
      this.logger.error(`Failed to store metrics for server ${serverId}`, error);
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

    this.logger.log(`Server ${serverId} status updated to ${status}`);
  }

  /**
   * Map Docker container status to our server status
   */
  private mapContainerStatusToServerStatus(containerStatus: string): ServerStatus {
    switch (containerStatus.toLowerCase()) {
      case 'running':
        return ServerStatus.RUNNING;
      case 'created':
      case 'restarting':
        return ServerStatus.STARTING;
      case 'paused':
      case 'exited':
        return ServerStatus.STOPPED;
      case 'dead':
        return ServerStatus.CRASHED;
      default:
        return ServerStatus.STOPPED;
    }
  }

  /**
   * Clean up old metrics (run daily)
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupOldMetrics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    try {
      const deleted = await this.prisma.serverMetric.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      this.logger.log(`Cleaned up ${deleted.count} old metrics`);
    } catch (error) {
      this.logger.error('Failed to cleanup old metrics', error);
    }
  }
}