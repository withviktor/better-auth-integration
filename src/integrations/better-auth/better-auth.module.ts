import { Module } from '@nestjs/common';
import { BetterAuthService } from './better-auth.service';
import { ResendModule } from '../resend/resend.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ResendModule, PrismaModule],
  providers: [BetterAuthService],
})
export class BetterAuthModule {}
