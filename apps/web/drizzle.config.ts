import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import path from 'node:path';

const envPath = path.resolve(process.cwd(), '.env.local');

config({ path: envPath });

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
