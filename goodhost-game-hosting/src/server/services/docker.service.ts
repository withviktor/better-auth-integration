import Docker from 'dockerode';
import { ContainerInfo, DockerOperation, ResourceMetrics } from '@/shared/types';
import { generateId, sanitizeContainerName } from '@/shared/utils';

export class DockerService {
  private docker: Docker;

  constructor() {
    this.docker = new Docker({
      socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock'
    });
  }

  // Test Docker connection
  async testConnection(): Promise<boolean> {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      console.error('Docker connection failed:', error);
      return false;
    }
  }

  // Create a new container
  async createContainer(config: {
    image: string;
    name: string;
    ports?: { [key: string]: string };
    environment?: { [key: string]: string };
    volumes?: { [key: string]: string };
    labels?: { [key: string]: string };
    resources?: {
      memory?: number;
      cpus?: number;
    };
  }): Promise<string> {
    try {
      const containerName = sanitizeContainerName(config.name);
      
      const containerConfig = {
        Image: config.image,
        name: containerName,
        Env: Object.entries(config.environment || {}).map(([key, value]) => `${key}=${value}`),
        Labels: config.labels || {},
        HostConfig: {
          Memory: config.resources?.memory ? config.resources.memory * 1024 * 1024 : undefined, // Convert MB to bytes
          CpuQuota: config.resources?.cpus ? Math.floor(config.resources.cpus * 100000) : undefined,
          CpuPeriod: 100000,
          PortBindings: this.formatPortBindings(config.ports || {}),
          Binds: Object.entries(config.volumes || {}).map(([host, container]) => `${host}:${container}`),
          RestartPolicy: {
            Name: 'unless-stopped'
          }
        },
        ExposedPorts: Object.keys(config.ports || {}).reduce((acc, port) => {
          acc[`${port}/tcp`] = {};
          return acc;
        }, {} as any)
      };

      const container = await this.docker.createContainer(containerConfig);
      return container.id;
    } catch (error) {
      console.error('Failed to create container:', error);
      throw new Error(`Failed to create container: ${error}`);
    }
  }

  // Start a container
  async startContainer(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.start();
    } catch (error) {
      console.error('Failed to start container:', error);
      throw new Error(`Failed to start container: ${error}`);
    }
  }

  // Stop a container
  async stopContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.stop({ t: timeout });
    } catch (error) {
      console.error('Failed to stop container:', error);
      throw new Error(`Failed to stop container: ${error}`);
    }
  }

  // Restart a container
  async restartContainer(containerId: string, timeout: number = 10): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.restart({ t: timeout });
    } catch (error) {
      console.error('Failed to restart container:', error);
      throw new Error(`Failed to restart container: ${error}`);
    }
  }

  // Delete a container
  async deleteContainer(containerId: string, force: boolean = false): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      await container.remove({ force });
    } catch (error) {
      console.error('Failed to delete container:', error);
      throw new Error(`Failed to delete container: ${error}`);
    }
  }

  // Get container information
  async getContainerInfo(containerId: string): Promise<ContainerInfo | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      
      return {
        id: info.Id,
        name: info.Name.replace('/', ''),
        status: info.State.Status,
        image: info.Config.Image,
        ports: info.NetworkSettings.Ports,
        state: info.State,
        created: info.Created,
        labels: info.Config.Labels || {}
      };
    } catch (error) {
      console.error('Failed to get container info:', error);
      return null;
    }
  }

  // List all containers
  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    try {
      const containers = await this.docker.listContainers({ all });
      
      return containers.map(container => ({
        id: container.Id,
        name: container.Names[0]?.replace('/', '') || '',
        status: container.Status,
        image: container.Image,
        ports: container.Ports.reduce((acc, port) => {
          if (port.PublicPort) {
            acc[`${port.PrivatePort}/${port.Type}`] = [{
              HostPort: port.PublicPort.toString(),
              HostIp: port.IP || '0.0.0.0'
            }];
          }
          return acc;
        }, {} as { [key: string]: Array<{ HostPort: string; HostIp: string }> }),
        state: {
          Status: container.Status,
          Running: container.Status.startsWith('Up'),
          Paused: container.Status.includes('Paused'),
          Restarting: container.Status.includes('Restarting'),
          OOMKilled: container.Status.includes('OOMKilled'),
          Dead: container.Status.includes('Dead'),
          Pid: 0,
          ExitCode: 0,
          Error: '',
          StartedAt: container.Status.startsWith('Up') ? new Date().toISOString() : '',
          FinishedAt: ''
        },
        created: new Date(container.Created * 1000).toISOString(),
        labels: container.Labels || {}
      }));
    } catch (error) {
      console.error('Failed to list containers:', error);
      return [];
    }
  }

  // Get container logs
  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    try {
      const container = this.docker.getContainer(containerId);
      const stream = await container.logs({
        stdout: true,
        stderr: true,
        tail,
        timestamps: true
      });
      
      return stream.toString();
    } catch (error) {
      console.error('Failed to get container logs:', error);
      throw new Error(`Failed to get container logs: ${error}`);
    }
  }

  // Get container resource usage
  async getContainerStats(containerId: string): Promise<ResourceMetrics | null> {
    try {
      const container = this.docker.getContainer(containerId);
      const stats = await container.stats({ stream: false });
      
      const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
      const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
      const cpuUsage = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;
      
      const memoryUsage = stats.memory_stats.usage || 0;
      const memoryLimit = stats.memory_stats.limit || 0;
      const memoryUsageMB = memoryUsage / (1024 * 1024);
      
      const networkStats = stats.networks || {};
      let networkIn = 0;
      let networkOut = 0;
      
      Object.values(networkStats).forEach((network: any) => {
        networkIn += network.rx_bytes || 0;
        networkOut += network.tx_bytes || 0;
      });
      
      return {
        cpuUsage: Math.min(cpuUsage, 100),
        memoryUsage: memoryUsageMB,
        diskUsage: 0, // Docker stats doesn't provide disk usage
        networkIn,
        networkOut,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Failed to get container stats:', error);
      return null;
    }
  }

  // Execute command in container
  async execCommand(containerId: string, command: string[]): Promise<{
    exitCode: number;
    output: string;
    error: string;
  }> {
    try {
      const container = this.docker.getContainer(containerId);
      const exec = await container.exec({
        Cmd: command,
        AttachStdout: true,
        AttachStderr: true
      });
      
      const stream = await exec.start({});
      
      let output = '';
      let error = '';
      
      return new Promise((resolve) => {
        stream.on('data', (chunk) => {
          output += chunk.toString();
        });
        
        stream.on('error', (err) => {
          error += err.toString();
        });
        
        stream.on('end', async () => {
          const inspect = await exec.inspect();
          resolve({
            exitCode: inspect.ExitCode || 0,
            output,
            error
          });
        });
      });
    } catch (error) {
      console.error('Failed to execute command:', error);
      throw new Error(`Failed to execute command: ${error}`);
    }
  }

  // Pull Docker image
  async pullImage(image: string): Promise<void> {
    try {
      await new Promise<void>((resolve, reject) => {
        this.docker.pull(image, (err: any, stream: any) => {
          if (err) {
            reject(err);
            return;
          }
          
          this.docker.modem.followProgress(stream, (err, output) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    } catch (error) {
      console.error('Failed to pull image:', error);
      throw new Error(`Failed to pull image: ${error}`);
    }
  }

  // Private helper methods
  private formatPortBindings(ports: { [key: string]: string }): { [key: string]: Array<{ HostPort: string; HostIp: string }> } {
    const bindings: { [key: string]: Array<{ HostPort: string; HostIp: string }> } = {};
    
    Object.entries(ports).forEach(([containerPort, hostPort]) => {
      bindings[`${containerPort}/tcp`] = [{
        HostPort: hostPort,
        HostIp: '0.0.0.0'
      }];
    });
    
    return bindings;
  }
}

// Singleton instance
export const dockerService = new DockerService();