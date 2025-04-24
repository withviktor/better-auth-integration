import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { apiKey, magicLink, openAPI } from 'better-auth/plugins';
import { prisma } from './prisma';
import { resend } from './resend';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      await resend.emails.send({
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
    apiKey({
      enableMetadata: true,
    }),
    magicLink({
      sendMagicLink: async ({ email, url, token }, request) => {
        await resend.emails.send({
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
