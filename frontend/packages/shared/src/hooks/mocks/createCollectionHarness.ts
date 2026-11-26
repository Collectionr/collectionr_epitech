import { createElement } from 'react';
import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

import type { ApiClient, ApiRequestOptions } from '../../services/apiClient';
import { createCollectionService } from '../../services/collectionService';
import { createQueryClient } from '../../services/queryClient';
import type {
  CardEntry,
  CardEntryView,
  CardView,
  Collection,
  CollectionCardsPage,
  SetView,
} from '../../types';
import { CollectionServiceContext } from '../collectionServiceContext';

/** Collection de test. */
export const TEST_COLLECTION: Collection = {
  id: '5d18e9d4-f2fc-4bee-8b9f-1c6bd24aa434',
  licenceTCGId: '88509b1d-1db6-4c0a-b9ac-26b5c07517ee',
  name: 'Classeur Base',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

/** Carte de test (Dracaufeu, Set de Base 4). */
export const TEST_CARD: CardView = {
  id: '09a987ad-21e7-45c5-9b66-e39e92ae5464',
  number: '4',
  nameEn: 'Charizard',
  nameFr: 'Dracaufeu',
  category: 'Pokemon',
  rarity: 'Rare',
  imageUrlEn: 'https://assets.tcgdex.net/en/base/base1/4',
  imageUrlFr: 'https://assets.tcgdex.net/fr/base/base1/4',
};

/** Set de test (Set de Base). */
export const TEST_SET: SetView = {
  id: 'c48a896b-41c6-482f-8875-8431c08449f6',
  tcgdexId: 'base1',
  nameEn: 'Base Set',
  nameFr: 'Set de Base',
  abbreviationOfficial: 'BS',
};

/**
 * Ligne de collection telle que l'API la renvoie à l'ajout.
 * @param overrides - Champs à remplacer
 */
export function cardEntry(overrides: Partial<CardEntry> = {}): CardEntry {
  return {
    id: 'ffdc02ba-1d2c-48cd-85fb-6390248e703b',
    collectionId: TEST_COLLECTION.id,
    cardId: TEST_CARD.id,
    variantId: null,
    quantity: 1,
    condition: 'NM',
    language: 'fr',
    gradingNote: null,
    notes: null,
    addedAt: '2026-11-21T09:00:00.000Z',
    updatedAt: '2026-11-21T09:00:00.000Z',
    ...overrides,
  };
}

/**
 * Ligne de collection avec les données du catalogue, telle que la liste des cartes la renvoie.
 * @param overrides - Champs à remplacer
 */
export function cardEntryView(overrides: Partial<CardEntryView> = {}): CardEntryView {
  return { ...cardEntry(), card: TEST_CARD, set: TEST_SET, variant: null, ...overrides };
}

/**
 * Page de cartes d'une collection.
 * @param items - Lignes de la page
 * @param page - Numéro de la page
 * @param total - Nombre de lignes de toute la collection
 */
export function cardsPage(
  items: CardEntryView[],
  page = 1,
  total = items.length,
): CollectionCardsPage {
  return { items, total, page, pageSize: 50 };
}

type Handler = (options: ApiRequestOptions | undefined) => Promise<unknown>;

/**
 * Doublure de l'environnement des hooks de collection : vrai service et cache configuré comme
 * l'application, sur un client API factice.
 * @param handlers - Réponse de chaque requête, par chemin complet (paramètres compris) ; une
 * requête absente fait échouer l'appel
 */
export function createCollectionHarness(handlers: Record<string, Handler> = {}) {
  const client = {
    request: vi.fn((path: string, options?: ApiRequestOptions) => {
      const handler = handlers[path];
      return handler ? handler(options) : Promise.reject(new Error(`Appel inattendu : ${path}`));
    }),
  } satisfies ApiClient;
  const collectionService = createCollectionService({ client });
  const queryClient = createQueryClient();

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, {
      client: queryClient,
      children: createElement(CollectionServiceContext.Provider, {
        value: collectionService,
        children,
      }),
    });
  }

  return { client, collectionService, queryClient, wrapper };
}
