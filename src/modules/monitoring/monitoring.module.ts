import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { DockerModule } from '../docker/docker.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [DockerModule, WebsocketModule],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}