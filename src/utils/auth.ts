import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
  admin,
  apiKey,
  magicLink,
  openAPI,
  organization,
} from 'better-auth/plugins';
import RaycastMagicLinkEmail from '../../emails/RaycastMagicLinkEmail';
import { prisma } from './prisma';
import { resend } from './resend';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ user, url, token }, request) => {
        await resend.emails.send({
          from: 'Avelio Company <hello@marketing.avelio.co>',
          to: user.email,
          subject: 'Change Email Verification',
          html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
          text: `Click ${url} to verify your email.`,
        });
      },
    },
    deleteUser: {
      enabled: true,
      sendDeleteAccountVerification: async ({ user, url, token }, request) => {
        await resend.emails.send({
          from: 'Avelio Company <hello@marketing.avelio.co>',
          to: user.email,
          subject: 'Delete Account Verification',
          html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
          text: `Click ${url} to verify your email.`,
        });
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      sendAccountLinkingVerification: async ({ user, url, token }, request) => {
        await resend.emails.send({
          from: 'Avelio Company <hello@marketing.avelio.co>',
          to: user.email,
          subject: 'Account Linking Verification',
          html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
          text: `Click ${url} to verify your email.`,
        });
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await resend.emails.send({
        from: 'Avelio Company <hello@marketing.avelio.co>',
        to: user.email,
        subject: 'Verify your email',
        html: `<p>Click <a href="${url}">here</a> to verify your email.</p>`,
        text: `Click ${url} to verify your email.`,
      });
    },
  },
  plugins: [
    openAPI(),
    apiKey({
      enableMetadata: true,
    }),
    admin(),
    organization({
      teams: {
        enabled: true,
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url, token }, request) => {
        await resend.emails.send({
          from: 'Avelio Company <hello@marketing.avelio.co>',
          to: email,
          subject: 'Magic Link',
          react: RaycastMagicLinkEmail({ magicLink: email }),
          text: `Click ${url} to log in.`,
        });
      },
    }),
  ],
});
