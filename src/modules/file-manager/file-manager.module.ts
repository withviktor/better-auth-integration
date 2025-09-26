import { Module } from '@nestjs/common';
import { FileManagerService } from './file-manager.service';
import { FileManagerController } from './file-manager.controller';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [DockerModule],
  controllers: [FileManagerController],
  providers: [FileManagerService],
  exports: [FileManagerService],
})
export class FileManagerModule {}