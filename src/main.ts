import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { PrismaService } from './modules/prisma/prisma.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  try {
    const app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: ['log', 'error', 'warn', 'debug', 'verbose'],
    });

    // Serve static files
    app.useStaticAssets(join(__dirname, '..', 'public'));

    // Enable validation pipes globally
    app.useGlobalPipes(new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }));

    // Enable CORS
    app.enableCors({
      origin: process.env.FRONTEND_URL || 'http://localhost:3001',
      credentials: true,
    });

    // Global prefix for API routes
    app.setGlobalPrefix('api', {
      exclude: ['/', '/health'],
    });

    // Enable Prisma shutdown hooks
    const prismaService = app.get(PrismaService);
    await prismaService.enableShutdownHooks(app);

    const port = process.env.PORT || 3000;
    await app.listen(port);

    logger.log(`🚀 GoodHost Server Management API is running on: http://localhost:${port}`);
    logger.log(`📊 Health check: http://localhost:${port}/health`);
    logger.log(`📖 API Info: http://localhost:${port}/api/info`);
    logger.log(`🔌 WebSocket: http://localhost:${port}/socket.io`);
  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

bootstrap();
