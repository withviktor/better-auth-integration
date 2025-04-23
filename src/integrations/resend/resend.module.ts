import { Module } from '@nestjs/common';
import { ResendService } from './resend.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ResendService],
  exports: [ResendService],
})
export class ResendModule {}
