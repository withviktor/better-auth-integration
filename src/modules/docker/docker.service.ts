import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as Docker from 'dockerode';
import { Stream } from 'stream';
import * as fs from 'fs-extra';
import * as path from 'path';

export interface ContainerConfig {
  name: string;
  image: string;
  ports?: { [key: string]: { HostPort: string } };
  environment?: string[];
  volumes?: string[];
  workingDir?: string;
  cmd?: string[];
  memoryLimit?: number; // in bytes
  cpuLimit?: number; // CPU quota (100000 = 1 CPU)
}

export interface ContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private readonly logger = new Logger(DockerService.name);
  private docker: Docker;

  constructor() {
    // Initialize Docker client
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
    });
  }

  async onModuleInit() {
    try {
      // Test Docker connection
      await this.docker.ping();
      this.logger.log('Docker connection established successfully');
      
      // Log Docker version info
      const info = await this.docker.version();
      this.logger.log(`Docker Engine version: ${info.Version}`);
    } catch (error) {
      this.logger.error('Failed to connect to Docker daemon', error);
      throw new Error('Docker daemon is not available');
    }
  }

  /**
   * Create and start a new container
   */
  async createContainer(config: ContainerConfig): Promise<string> {
    try {
      this.logger.log(`Creating container: ${config.name}`);

      // Pull image if it doesn't exist locally
      await this.pullImage(config.image);

      const container = await this.docker.createContainer({
        name: config.name,
        Image: config.image,
        Cmd: config.cmd,
        WorkingDir: config.workingDir,
        Env: config.environment,
        ExposedPorts: config.ports ? Object.keys(config.ports).reduce((acc, port) => {
          acc[port] = {};
          return acc;
        }, {}) : undefined,
        HostConfig: {
          PortBindings: config.ports,
          Binds: config.volumes,
          Memory: config.memoryLimit,
          CpuQuota: config.cpuLimit,
          RestartPolicy: { Name: 'unless-stopped' },
          AutoRemove: false,
        },
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        OpenStdin: true,
      });

      this.logger.log(`Container created successfully: ${container.id}`);
      return container.id;
    } catch (error) {
      this.logger.error(`Failed to create container ${config.name}`, error);
      throw error;
    }
  }

  /**
   * Start a container
   */
  async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
      this.logger.log(`Container started: ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to start container ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Stop a container
   */
  async stopContainer(containerId: string, timeout = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: timeout });
      this.logger.log(`Container stopped: ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to stop container ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Restart a container
   */
  async restartContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart();
      this.logger.log(`Container restarted: ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to restart container ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(containerId: string, force = false): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force });
      this.logger.log(`Container removed: ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to remove container ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Get container status
   */
  async getContainerStatus(containerId: string): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State.Status;
    } catch (error) {
      this.logger.error(`Failed to get container status ${containerId}`, error);
      return 'unknown';
    }
  }

  /**
   * Get container statistics
   */
  async getContainerStats(containerId: string): Promise<ContainerStats> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });

      // Calculate CPU usage percentage
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuUsage = (cpuDelta / systemDelta) * stats.cpu_stats.online_cpus * 100;

      // Memory usage
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;

      // Network I/O
      const networks = stats.networks || {};
      const networkRx = Object.values(networks).reduce((sum: number, net: any) => sum + (net.rx_bytes || 0), 0);
      const networkTx = Object.values(networks).reduce((sum: number, net: any) => sum + (net.tx_bytes || 0), 0);

      return {
        cpuUsage: Math.round(cpuUsage * 100) / 100,
        memoryUsage,
        memoryLimit,
        networkRx,
        networkTx,
      };
    } catch (error) {
      this.logger.error(`Failed to get container stats ${containerId}`, error);
      return {
        cpuUsage: 0,
        memoryUsage: 0,
        memoryLimit: 0,
        networkRx: 0,
        networkTx: 0,
      };
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(containerId: string, tail = 100): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const logs = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true,
      });
      return logs.toString();
    } catch (error) {
      this.logger.error(`Failed to get container logs ${containerId}`, error);
      return '';
    }
  }

  /**
   * Stream container logs
   */
  async streamContainerLogs(containerId: string): Promise<Stream> {
    try {
      const container = this.docker.getContainer(containerId);
      return await container.logs({
        stdout: true,
        stderr: true,
        follow: true,
        timestamps: true,
      });
    } catch (error) {
      this.logger.error(`Failed to stream container logs ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Execute command in container
   */
  async execInContainer(containerId: string, cmd: string[]): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: cmd,
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });
      
      return new Promise((resolve, reject) => {
        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });
        stream.on('end', () => resolve(output));
        stream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to execute command in container ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Pull Docker image
   */
  private async pullImage(imageName: string): Promise<void> {
    try {
      this.logger.log(`Pulling Docker image: ${imageName}`);
      
      // Check if image exists locally
      try {
        await this.docker.getImage(imageName).inspect();
        this.logger.log(`Image ${imageName} already exists locally`);
        return;
      } catch {
        // Image doesn't exist locally, need to pull
      }

      const stream = await this.docker.pull(imageName);
      
      return new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) {
            this.logger.error(`Failed to pull image ${imageName}`, err);
            reject(err);
          } else {
            this.logger.log(`Successfully pulled image: ${imageName}`);
            resolve();
          }
        });
      });
    } catch (error) {
      this.logger.error(`Failed to pull image ${imageName}`, error);
      throw error;
    }
  }

  /**
   * List all containers
   */
  async listContainers(all = false): Promise<Docker.ContainerInfo[]> {
    try {
      return await this.docker.listContainers({ all });
    } catch (error) {
      this.logger.error('Failed to list containers', error);
      return [];
    }
  }

  /**
   * Get Docker system info
   */
  async getSystemInfo(): Promise<any> {
    try {
      return await this.docker.info();
    } catch (error) {
      this.logger.error('Failed to get Docker system info', error);
      return null;
    }
  }

  /**
   * Create a backup of container volumes
   */
  async createVolumeBackup(containerId: string, backupPath: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const tarStream = await container.getArchive({ path: '/' });
      
      await fs.ensureDir(path.dirname(backupPath));
      const writeStream = fs.createWriteStream(backupPath);
      
      return new Promise((resolve, reject) => {
        tarStream.pipe(writeStream);
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });
    } catch (error) {
      this.logger.error(`Failed to create volume backup for container ${containerId}`, error);
      throw error;
    }
  }

  /**
   * Restore container volumes from backup
   */
  async restoreVolumeBackup(containerId: string, backupPath: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      const readStream = fs.createReadStream(backupPath);
      
      await container.putArchive(readStream, { path: '/' });
      this.logger.log(`Volume backup restored for container ${containerId}`);
    } catch (error) {
      this.logger.error(`Failed to restore volume backup for container ${containerId}`, error);
      throw error;
    }
  }
}