import { setupWorker } from 'msw/browser';

import type { ApiMocksMode } from '@/config/apiMocks';

import { createApiHandlers } from './handlers';

/**
 * Démarre les données simulées dans le navigateur (service worker `public/mockServiceWorker.js`).
 * Les requêtes sans handler partent vers la vraie API.
 * @param mode - Mode de `VITE_API_MOCKS`
 * @param baseUrl - URL de base de l'API
 */
export async function startApiMocks(mode: ApiMocksMode, baseUrl: string): Promise<void> {
  const worker = setupWorker(...createApiHandlers(mode, baseUrl));
  await worker.start({ onUnhandledRequest: 'bypass' });
}
