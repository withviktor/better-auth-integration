import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { auth } from './utils/auth';
import { toNodeHandler } from 'better-auth/node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const expressApp = express();
  expressApp.all('/api/auth/*splat', toNodeHandler(auth));

  expressApp.use(express.json());

  app.use(expressApp);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
