import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

const CONFIG_DIR = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_API_PROXY_TARGET = 'http://localhost:3000';
/** Service worker de MSW, généré dans public/ par `msw init` (données simulées, dev uniquement). */
const MOCK_SERVICE_WORKER = 'mockServiceWorker.js';

/**
 * Les données simulées ne servent qu'en dev (`VITE_API_MOCKS`) : leur service worker, copié de
 * public/ comme tout fichier statique, est retiré du build de production.
 */
function excludeMockServiceWorker(): Plugin {
  let outDir = '';
  return {
    name: 'collectionr:exclude-mock-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      rmSync(join(outDir, MOCK_SERVICE_WORKER), { force: true });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, CONFIG_DIR, '');

  return {
    plugins: [react(), excludeMockServiceWorker()],
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
