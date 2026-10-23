import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, CONFIG_DIR, '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/api': env.API_PROXY_TARGET || DEFAULT_API_PROXY_TARGET,
      },
    },
  };
});
