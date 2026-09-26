import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: path.resolve(__dirname, 'src/main/index.ts'),
      },
    },
  },

  preload: {
    build: {
      externalizeDeps: {
        exclude: ['@better-auth/electron'],
      },
      rollupOptions: {
        input: path.resolve(__dirname, 'src/preload/index.ts'),
      },
    },
  },

  renderer: {
    root: path.resolve(__dirname, 'src/renderer'),
    plugins: [react()],
  },
});
