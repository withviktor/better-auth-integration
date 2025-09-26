import Docker from "dockerode";
import { Server, ServerInstance, InstanceStatus, ServerStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { EventEmitter } from "events";

export class ServerManager extends EventEmitter {
  private docker: Docker;
  private instances = new Map<string, ServerInstance>();

  constructor() {
    super();
    this.docker = new Docker();

    // Start monitoring existing containers
    this.initializeMonitoring();
  }

  private async initializeMonitoring() {
    try {
      const containers = await this.docker.listContainers({
        filters: {
          label: ["goodhost.managed=true"],
        },
      });

      for (const container of containers) {
        const serverId = container.Labels?.["goodhost.serverId"];
        if (serverId) {
          // Update database with running container info
          await this.syncContainerWithDatabase(container, serverId);
        }
      }
    } catch (error) {
      console.error("Failed to initialize container monitoring:", error);
    }
  }

  async startServer(server: Server): Promise<void> {
    try {
      // Check if server is already running
      const existingInstance = await prisma.serverInstance.findFirst({
        where: {
          serverId: server.id,
          status: { in: ["RUNNING"] },
        },
      });

      if (existingInstance) {
        throw new Error("Server is already running");
      }

      // Create server configuration
      const config = this.createServerConfig(server);

      // Create and start container
      const container = await this.docker.createContainer({
        Image: server.dockerImage,
        name: `goodhost-${server.id}`,
        Env: this.buildEnvironmentVariables(server),
        Labels: {
          "goodhost.managed": "true",
          "goodhost.serverId": server.id,
        },
        HostConfig: {
          PortBindings: {
            [`${server.port}/tcp`]: [{ HostPort: server.port.toString() }],
          },
          Memory: server.memoryLimit * 1024 * 1024, // Convert MB to bytes
          CpuQuota: server.cpuLimit * 1000, // Convert millicores to quota
          CpuPeriod: 100000, // 100ms period
          RestartPolicy: { Name: "unless-stopped" },
          Binds: [
            `/opt/goodhost/servers/${server.id}:/data`,
          ],
        },
        ...config,
      });

      await container.start();

      // Create database instance record
      const instance = await prisma.serverInstance.create({
        data: {
          serverId: server.id,
          containerId: container.id,
          status: InstanceStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      this.instances.set(server.id, instance);

      // Update server status
      await prisma.server.update({
        where: { id: server.id },
        data: { status: ServerStatus.ONLINE },
      });

      // Start monitoring
      this.startMonitoring(server.id, container);

      this.emit("serverStarted", { server, instance });
    } catch (error) {
      console.error(`Failed to start server ${server.id}:`, error);
      await prisma.server.update({
        where: { id: server.id },
        data: { status: ServerStatus.ERROR },
      });
      throw error;
    }
  }

  async stopServer(server: Server): Promise<void> {
    try {
      const instance = await prisma.serverInstance.findFirst({
        where: {
          serverId: server.id,
          status: { in: ["RUNNING"] },
        },
      });

      if (!instance || !instance.containerId) {
        throw new Error("Server is not running");
      }

      const container = this.docker.getContainer(instance.containerId);
      await container.stop({ t: 30 }); // 30 second timeout

      // Update database
      await prisma.serverInstance.update({
        where: { id: instance.id },
        data: {
          status: InstanceStatus.STOPPED,
          stoppedAt: new Date(),
        },
      });

      await prisma.server.update({
        where: { id: server.id },
        data: { status: ServerStatus.OFFLINE },
      });

      this.instances.delete(server.id);
      this.emit("serverStopped", { server, instance });
    } catch (error) {
      console.error(`Failed to stop server ${server.id}:`, error);
      throw error;
    }
  }

  async restartServer(server: Server): Promise<void> {
    await this.stopServer(server);
    // Wait a moment before starting
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.startServer(server);
  }

  async getLogs(server: Server): Promise<string[]> {
    const instance = await prisma.serverInstance.findFirst({
      where: {
        serverId: server.id,
        status: { in: ["RUNNING"] },
      },
    });

    if (!instance || !instance.containerId) {
      return [];
    }

    try {
      const container = this.docker.getContainer(instance.containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail: 100,
        timestamps: true,
      });

      return logs.toString().split('\n').filter(line => line.trim());
    } catch (error) {
      console.error(`Failed to get logs for server ${server.id}:`, error);
      return [];
    }
  }

  private createServerConfig(server: Server) {
    const baseConfig = {
      Tty: true,
      OpenStdin: false,
      StdinOnce: false,
    };

    // Game-specific configurations
    switch (server.gameType) {
      case "MINECRAFT_JAVA":
        return {
          ...baseConfig,
          Cmd: ["java", "-Xmx1024M", "-Xms512M", "-jar", "server.jar", "nogui"],
        };
      case "MINECRAFT_PAPER":
        return {
          ...baseConfig,
          Cmd: ["java", "-Xmx1024M", "-Xms512M", "-jar", "paper.jar", "--nogui"],
        };
      default:
        return baseConfig;
    }
  }

  private buildEnvironmentVariables(server: Server): string[] {
    const env: string[] = [
      `SERVER_PORT=${server.port}`,
      `MAX_PLAYERS=${server.maxPlayers}`,
    ];

    if (server.motd) {
      env.push(`MOTD=${server.motd}`);
    }

    // Add game-specific environment variables
    switch (server.gameType) {
      case "MINECRAFT_JAVA":
        env.push(
          "EULA=TRUE",
          "ONLINE_MODE=false",
          "DIFFICULTY=normal",
          "PVP=true"
        );
        break;
    }

    return env;
  }

  private async startMonitoring(serverId: string, container: Docker.Container) {
    // Monitor container stats every 30 seconds
    const monitoringInterval = setInterval(async () => {
      try {
        const stats = await container.stats({ stream: false });
        const instance = await prisma.serverInstance.findFirst({
          where: { serverId, status: "RUNNING" },
        });

        if (instance) {
          // Update database with current stats
          await prisma.resourceUsage.create({
            data: {
              serverId,
              cpuUsage: this.calculateCPUUsage(stats.cpu_stats, stats.precpu_stats),
              memoryUsage: (stats.memory_stats.usage / stats.memory_stats.limit) * 100,
              diskUsage: 0, // Would need to calculate from container filesystem
              networkIn: stats.networks?.eth0?.rx_bytes || 0,
              networkOut: stats.networks?.eth0?.tx_bytes || 0,
              players: 0, // Would need to parse server logs or use RCON
            },
          });

          // Update instance uptime
          if (instance.startedAt) {
            const uptime = Math.floor((Date.now() - instance.startedAt.getTime()) / 1000);
            await prisma.serverInstance.update({
              where: { id: instance.id },
              data: { uptime },
            });
          }
        }
      } catch (error) {
        console.error(`Failed to monitor server ${serverId}:`, error);
        clearInterval(monitoringInterval);
      }
    }, 30000);

    // Stop monitoring when container stops
    container.wait().then(() => {
      clearInterval(monitoringInterval);
    });
  }

  private calculateCPUUsage(cpuStats: any, preCpuStats: any): number {
    const cpuDelta = cpuStats.cpu_usage.total_usage - (preCpuStats?.cpu_usage?.total_usage || 0);
    const systemDelta = cpuStats.system_cpu_usage - (preCpuStats?.system_cpu_usage || 0);

    if (systemDelta > 0 && cpuDelta > 0) {
      const cpuPercent = (cpuDelta / systemDelta) * cpuStats.online_cpus * 100;
      return Math.round(cpuPercent * 100) / 100;
    }

    return 0;
  }

  private async syncContainerWithDatabase(container: Docker.ContainerInfo, serverId: string) {
    const instance = await prisma.serverInstance.findFirst({
      where: { serverId },
    });

    if (instance) {
      await prisma.serverInstance.update({
        where: { id: instance.id },
        data: {
          status: InstanceStatus.RUNNING,
          containerId: container.Id,
          startedAt: new Date(container.Created * 1000),
        },
      });
    }
  }
}

// Export singleton instance
export const serverManager = new ServerManager();