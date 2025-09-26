import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { GameServerModule } from './modules/game-server/game-server.module';
import { DockerModule } from './modules/docker/docker.module';
import { AuthModule } from './modules/auth/auth.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { TemplateModule } from './modules/template/template.module';
import { BackupModule } from './modules/backup/backup.module';
import { FileManagerModule } from './modules/file-manager/file-manager.module';

@Module({
  imports: [
    // Core configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    
    // Task scheduling
    ScheduleModule.forRoot(),
    
    // Job queue with Redis
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD,
      },
    }),
    
    // Core modules
    PrismaModule,
    AuthModule,
    
    // Game server management
    GameServerModule,
    DockerModule,
    TemplateModule,
    BackupModule,
    FileManagerModule,
    
    // Real-time features
    WebsocketModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
