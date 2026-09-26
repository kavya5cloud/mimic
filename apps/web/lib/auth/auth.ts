import { betterAuth } from 'better-auth';
import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { electron } from '@better-auth/electron';
import { db } from '../db';
import * as schema from '../db/schema';

const baseURL = process.env.BETTER_AUTH_URL;

if (!baseURL) {
  throw new Error('BETTER_AUTH_URL is not configured');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),

  baseURL,

  trustedOrigins: ['mimic:/', 'mimic://auth'],

  plugins: [electron()],

  emailAndPassword: {
    enabled: false,
  },

  emailVerification: {
    sendVerificationEmail: async () => {
      // Email delivery will be wired after the auth/database
      // foundation is verified.
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});
