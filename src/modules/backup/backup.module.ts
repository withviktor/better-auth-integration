import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { BackupService } from './backup.service';
import { BackupController } from './backup.controller';
import { BackupProcessor } from './processors/backup.processor';
import { DockerModule } from '../docker/docker.module';

@Module({
  imports: [
    DockerModule,
    BullModule.registerQueue({
      name: 'backup-jobs',
    }),
  ],
  controllers: [BackupController],
  providers: [BackupService, BackupProcessor],
  exports: [BackupService],
})
export class BackupModule {}