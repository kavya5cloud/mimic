import { createAuthClient } from 'better-auth/react';
import { electronProxyClient } from '@better-auth/electron/proxy';

export const authClient = createAuthClient({
  baseURL:
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ??
    process.env.BETTER_AUTH_URL ??
    'http://localhost:3000',

  plugins: [
    electronProxyClient({
      protocol: {
        scheme: 'mimic',
      },
    }),
  ],
});
