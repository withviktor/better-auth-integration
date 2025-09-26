import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { GameServerService } from '../game-server.service';

@Processor('server-jobs')
export class ServerJobProcessor {
  private readonly logger = new Logger(ServerJobProcessor.name);

  constructor(private gameServerService: GameServerService) {}

  @Process('install-server')
  async handleInstallServer(job: Job<{ serverId: string; userId: string }>) {
    const { serverId, userId } = job.data;
    this.logger.log(`Processing install-server job for server: ${serverId}`);

    try {
      await this.gameServerService.installServer(serverId);
      this.logger.log(`Install-server job completed for server: ${serverId}`);
    } catch (error) {
      this.logger.error(`Install-server job failed for server: ${serverId}`, error);
      throw error;
    }
  }

  @Process('start-server')
  async handleStartServer(job: Job<{ serverId: string; userId: string }>) {
    const { serverId, userId } = job.data;
    this.logger.log(`Processing start-server job for server: ${serverId}`);

    try {
      await this.gameServerService.startServerContainer(serverId);
      this.logger.log(`Start-server job completed for server: ${serverId}`);
    } catch (error) {
      this.logger.error(`Start-server job failed for server: ${serverId}`, error);
      throw error;
    }
  }

  @Process('stop-server')
  async handleStopServer(job: Job<{ serverId: string; userId: string }>) {
    const { serverId, userId } = job.data;
    this.logger.log(`Processing stop-server job for server: ${serverId}`);

    try {
      await this.gameServerService.stopServerContainer(serverId);
      this.logger.log(`Stop-server job completed for server: ${serverId}`);
    } catch (error) {
      this.logger.error(`Stop-server job failed for server: ${serverId}`, error);
      throw error;
    }
  }

  @Process('restart-server')
  async handleRestartServer(job: Job<{ serverId: string; userId: string }>) {
    const { serverId, userId } = job.data;
    this.logger.log(`Processing restart-server job for server: ${serverId}`);

    try {
      // Stop first
      await this.gameServerService.stopServerContainer(serverId);
      
      // Wait a moment before starting
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Then start
      await this.gameServerService.startServerContainer(serverId);
      
      this.logger.log(`Restart-server job completed for server: ${serverId}`);
    } catch (error) {
      this.logger.error(`Restart-server job failed for server: ${serverId}`, error);
      throw error;
    }
  }

  @Process('delete-server')
  async handleDeleteServer(job: Job<{ serverId: string; userId: string }>) {
    const { serverId, userId } = job.data;
    this.logger.log(`Processing delete-server job for server: ${serverId}`);

    try {
      await this.gameServerService.deleteServerContainer(serverId);
      this.logger.log(`Delete-server job completed for server: ${serverId}`);
    } catch (error) {
      this.logger.error(`Delete-server job failed for server: ${serverId}`, error);
      throw error;
    }
  }
}