import { createAuthClient } from 'better-auth/client';
import { electronClient } from '@better-auth/electron/client';
import { storage } from '@better-auth/electron/storage';

const WEB_URL = process.env.MIMIC_WEB_URL ?? 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: WEB_URL,
  plugins: [
    electronClient({
      signInURL: `${WEB_URL}/`,
      protocol: {
        scheme: 'mimic',
      },
      storage: storage(),
    }),
  ],
});
