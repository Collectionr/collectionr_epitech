import { http, HttpResponse } from 'msw';
import type { HttpHandler } from 'msw';

import { CARD_CONDITIONS, CARD_ENTRY_QUANTITY, CARD_LANGUAGES } from '@shared/constants';
import type { CardEntry, CardEntryView } from '@shared/types';

import { apiError } from './apiErrors';
import { findMockCard } from './data/catalogue';
import type { MockCollectionStore } from './data/collections';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

/** Messages fixes du back (module collection), en anglais comme lui. */
const MESSAGES = {
  collectionId: 'Collection id must be a valid UUID',
  cardId: 'Card id must be a valid UUID',
  variantId: 'Variant id must be a valid UUID',
  collectionNotFound: 'Collection not found',
  cardNotFound: 'Card or variant not found for this collection',
  quantity: `Quantity must be an integer between ${CARD_ENTRY_QUANTITY.min} and ${CARD_ENTRY_QUANTITY.max}`,
  condition: `Condition must be one of: ${CARD_CONDITIONS.join(', ')}`,
  language: `Language must be one of: ${CARD_LANGUAGES.join(', ')}`,
  page: 'Page and page size must be positive integers (page size 100 at most)',
} as const;

function readBodyField(body: unknown, field: string): unknown {
  return typeof body === 'object' && body !== null ? Reflect.get(body, field) : undefined;
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return allowed.some((candidate) => candidate === value);
}

function readPositiveInteger(value: string | null, fallback: number): number | null {
  if (value === null) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

/** Ligne telle que l'API la renvoie à l'ajout (`CardEntryResponseDto`) : sans les données du catalogue. */
function toEntryResponse(entry: CardEntryView): CardEntry {
  return {
    id: entry.id,
    collectionId: entry.collectionId,
    cardId: entry.cardId,
    variantId: entry.variantId,
    quantity: entry.quantity,
    condition: entry.condition,
    language: entry.language,
    gradingNote: entry.gradingNote,
    notes: entry.notes,
    addedAt: entry.addedAt,
    updatedAt: entry.updatedAt,
  };
}

/**
 * Handlers simulés des collections, alignés sur `CollectionsController` du back : mêmes chemins,
 * mêmes réponses (DTO), mêmes erreurs (400 identifiant ou données invalides, 404 collection ou carte
 * inconnue). L'authentification n'est pas vérifiée : le jeton est celui de la vraie session.
 * @param baseUrl - URL de base de l'API (`/api/v1`, ou URL absolue)
 * @param store - Collections simulées, modifiées par les ajouts
 */
export function createCollectionHandlers(
  baseUrl: string,
  store: MockCollectionStore,
): HttpHandler[] {
  const collectionsUrl = `${baseUrl}/collections`;

  /** Collection demandée, ou réponse d'erreur du back. */
  function findCollection(request: Request, collectionId: unknown) {
    if (!isUuid(collectionId)) {
      return { error: apiError(request, 400, MESSAGES.collectionId) } as const;
    }
    const collection = store.collections.find(({ id }) => id === collectionId);
    if (collection === undefined) {
      return { error: apiError(request, 404, MESSAGES.collectionNotFound) } as const;
    }
    return { collection, entries: store.entries.get(collection.id) ?? [] } as const;
  }

  return [
    http.get(collectionsUrl, () =>
      HttpResponse.json(
        [...store.collections].sort((first, second) =>
          second.createdAt.localeCompare(first.createdAt),
        ),
      ),
    ),

    http.get(`${collectionsUrl}/:id/cards`, ({ request, params }) => {
      const found = findCollection(request, params.id);
      if ('error' in found) {
        return found.error;
      }
      const query = new URL(request.url).searchParams;
      const page = readPositiveInteger(query.get('page'), 1);
      const pageSize = readPositiveInteger(query.get('pageSize'), DEFAULT_PAGE_SIZE);
      if (page === null || pageSize === null || pageSize > MAX_PAGE_SIZE) {
        return apiError(request, 400, MESSAGES.page);
      }
      const start = (page - 1) * pageSize;
      return HttpResponse.json({
        items: found.entries.slice(start, start + pageSize),
        total: found.entries.length,
        page,
        pageSize,
      });
    }),

    http.post(`${collectionsUrl}/:id/cards`, async ({ request, params }) => {
      const found = findCollection(request, params.id);
      if ('error' in found) {
        return found.error;
      }
      const body: unknown = await request.json();
      const cardId = readBodyField(body, 'cardId');
      const variantId = readBodyField(body, 'variantId') ?? null;
      const quantity = readBodyField(body, 'quantity');
      const condition = readBodyField(body, 'condition');
      const language = readBodyField(body, 'language');

      if (!isUuid(cardId)) {
        return apiError(request, 400, MESSAGES.cardId);
      }
      if (variantId !== null && !isUuid(variantId)) {
        return apiError(request, 400, MESSAGES.variantId);
      }
      if (
        typeof quantity !== 'number' ||
        !Number.isInteger(quantity) ||
        quantity < CARD_ENTRY_QUANTITY.min ||
        quantity > CARD_ENTRY_QUANTITY.max
      ) {
        return apiError(request, 400, MESSAGES.quantity);
      }
      if (!isOneOf(condition, CARD_CONDITIONS)) {
        return apiError(request, 400, MESSAGES.condition);
      }
      if (!isOneOf(language, CARD_LANGUAGES)) {
        return apiError(request, 400, MESSAGES.language);
      }

      const catalogueCard = findMockCard(cardId);
      const variant =
        variantId === null
          ? null
          : catalogueCard?.variants.find((candidate) => candidate.id === variantId);
      if (catalogueCard === undefined || variant === undefined) {
        return apiError(request, 404, MESSAGES.cardNotFound);
      }

      const now = new Date().toISOString();
      // Comme le back : chaque ajout crée une nouvelle ligne, jamais fusionnée avec une autre.
      const entry: CardEntryView = {
        id: crypto.randomUUID(),
        collectionId: found.collection.id,
        cardId,
        variantId,
        quantity,
        condition,
        language,
        gradingNote: null,
        notes: null,
        addedAt: now,
        updatedAt: now,
        card: catalogueCard.card,
        set: catalogueCard.set,
        variant,
      };
      store.entries.set(found.collection.id, [entry, ...found.entries]);
      return HttpResponse.json(toEntryResponse(entry), { status: 201 });
    }),
  ];
}
