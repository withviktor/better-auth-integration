import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResendService } from '../resend/resend.service';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink, openAPI } from 'better-auth/plugins';

@Injectable()
export class BetterAuthService {
  public auth: ReturnType<typeof betterAuth>;

  constructor(
    private readonly resendService: ResendService,
    private readonly prismaService: PrismaService,
  ) {
    this.auth = betterAuth({
      database: prismaAdapter(this.prismaService, {
        provider: 'postgresql',
      }),
      emailAndPassword: {
        enabled: true,
      },
      emailVerification: {
        sendOnSignUp: true,
        sendVerificationEmail: async ({ user, url, token }, request) => {
          await this.resendService.emails.send({
            from: 'Acme <onboarding@marketing.tildes.me>',
            to: user.email,
            subject: 'Verify your email',
            html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
            text: `Click ${url} to verify your email.`,
          });
        },
      },
      plugins: [
        openAPI(),
        magicLink({
          sendMagicLink: async ({ email, url, token }, request) => {
            await this.resendService.emails.send({
              from: 'Acme <onboarding@marketing.tildes.me>',
              to: email,
              subject: 'Magic Link',
              html: `<p>Click <a href="${url}">here</a> to log in.</p>`,
              text: `Click ${url} to log in.`,
            });
          },
        }),
      ],
    });
  }
}
