import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class ResendService extends Resend {
  constructor(private readonly configService: ConfigService) {
    super(configService.get('RESEND_KEY'));
  }
}
