import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, __dirname, ''), ...process.env };
  const basePath = (env.VITE_BASE_PATH || '/').replace(/\/+$/, '');

  return {
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
