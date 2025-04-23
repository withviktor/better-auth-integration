import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { BetterAuthModule } from './integrations/better-auth/better-auth.module';
import { PrismaModule } from './integrations/prisma/prisma.module';
import { ResendModule } from './integrations/resend/resend.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ResendModule,
    PrismaModule,
    BetterAuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
  exports: [BetterAuthModule],
})
export class AppModule {}
