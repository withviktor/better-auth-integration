import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { BetterAuthService } from './integrations/better-auth/better-auth.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const betterAuthService = app.get(BetterAuthService);

  const expressApp = express();
  expressApp.all('/api/auth/*splat', toNodeHandler(betterAuthService.auth));

  expressApp.use(express.json());

  app.use(expressApp);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
