import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GameServerService } from './game-server.service';
import { GameServerController } from './game-server.controller';
import { ServerJobProcessor } from './processors/server-job.processor';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [
    DockerModule,
    BullModule.registerQueue({
      name: 'server-jobs',
    }),
  ],
  controllers: [GameServerController],
  providers: [GameServerService, ServerJobProcessor],
  exports: [GameServerService],
})
export class GameServerModule {}