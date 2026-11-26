import { createElement } from 'react';
import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

import type { AbortSignalLike, ApiClient, ApiRequestOptions } from '../../services/apiClient';
import { createCatalogService } from '../../services/catalogService';
import { createQueryClient } from '../../services/queryClient';
import type { CatalogCard } from '../../types';
import { CatalogServiceContext } from '../catalogServiceContext';
import { TEST_CARD, TEST_SET } from './createCollectionHarness';

/**
 * Carte trouvée dans le catalogue, pour les tests.
 * @param nameFr - Nom français de la carte
 */
export function catalogCard(nameFr: string): CatalogCard {
  return { card: { ...TEST_CARD, id: `carte-${nameFr}`, nameFr }, set: TEST_SET, variants: [] };
}

const SEARCH_TERM = /[?&]q=([^&]*)/;

/**
 * Doublure de l'environnement de la recherche dans le catalogue : vrai service et cache configuré
 * comme l'application, sur un client API factice.
 * @param respond - Réponse à la recherche d'un terme ; reçoit le signal d'annulation de la requête
 */
export function createCatalogHarness(
  respond: (term: string, signal: AbortSignalLike | undefined) => Promise<unknown>,
) {
  const client = {
    request: vi.fn((path: string, options?: ApiRequestOptions) => {
      const term = decodeURIComponent(SEARCH_TERM.exec(path)?.[1] ?? '');
      return respond(term, options?.signal);
    }),
  } satisfies ApiClient;
  const catalogService = createCatalogService({ client });
  const queryClient = createQueryClient();

  /** Termes cherchés, dans l'ordre des requêtes. */
  function searchedTerms(): string[] {
    return client.request.mock.calls.map(([path]) =>
      decodeURIComponent(SEARCH_TERM.exec(path)?.[1] ?? ''),
    );
  }

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, {
      client: queryClient,
      children: createElement(CatalogServiceContext.Provider, { value: catalogService, children }),
    });
  }

  return { client, queryClient, searchedTerms, wrapper };
}
