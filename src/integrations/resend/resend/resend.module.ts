import { Module } from '@nestjs/common';
import { ResendService } from './resend.service';

@Module({
  providers: [ResendService]
})
export class ResendModule {}
