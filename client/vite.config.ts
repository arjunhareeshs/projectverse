import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// One global env file: VITE_* values are read from the repo-root .env (not client/.env).
// Docker builds ignore .env files, so they receive these as build args / process env instead.
const envDir = path.resolve(__dirname, '..');

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  const basePath = (env.VITE_BASE_PATH || '/').replace(/\/+$/, '');

  return {
  envDir,
  base: `${basePath}/`,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 7333,
    strictPort: true,
  },
  };
});
