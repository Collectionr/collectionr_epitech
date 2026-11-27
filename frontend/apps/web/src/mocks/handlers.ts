import type { HttpHandler } from 'msw';

import type { ApiMocksMode } from '@/config/apiMocks';

import { createCatalogueHandlers } from './catalogueHandlers';
import { createCollectionHandlers } from './collectionHandlers';
import { createMockCollectionStore } from './data/collections';

/**
 * Handlers simulés du mode demandé. Une requête sans handler part vers la vraie API.
 * @param mode - Mode de `VITE_API_MOCKS`
 * @param baseUrl - URL de base de l'API
 */
export function createApiHandlers(mode: ApiMocksMode, baseUrl: string): HttpHandler[] {
  switch (mode) {
    case 'catalogue':
      return createCatalogueHandlers(baseUrl);
    case 'all':
      return [
        ...createCatalogueHandlers(baseUrl),
        ...createCollectionHandlers(baseUrl, createMockCollectionStore()),
      ];
  }
}
