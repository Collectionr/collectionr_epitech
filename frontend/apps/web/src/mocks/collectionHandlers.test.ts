// @vitest-environment node
// fetch de Node (undici) refuse le signal d'annulation de jsdom : ce test d'intégration tourne sous Node.
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError, createApiClient, createCollectionService } from '@shared/services';

import { createCollectionHandlers } from './collectionHandlers';
import { MOCK_CATALOGUE } from './data/catalogue';
import { createMockCollectionStore } from './data/collections';

const BASE_URL = 'http://localhost/api/v1';
const CLASSEUR_BASE = '5d18e9d4-f2fc-4bee-8b9f-1c6bd24aa434';
const DOUBLES = '4b1c5382-d4e8-4dc4-94d8-8de6c71ebb63';
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const [CHARIZARD, , , , , , FURRET] = MOCK_CATALOGUE;

const server = setupServer();
const service = createCollectionService({
  client: createApiClient({
    baseUrl: BASE_URL,
    // Lu à chaque appel : MSW remplace le fetch global au démarrage du serveur, après cet import.
    fetch: (url, init) => fetch(url, init),
    createAbortController: () => new AbortController(),
  }),
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Jeu de collections neuf pour chaque test. */
function useMockCollections() {
  server.use(...createCollectionHandlers(BASE_URL, createMockCollectionStore()));
}

function entryFor(cardId: string, overrides: Record<string, unknown> = {}) {
  return { cardId, quantity: 1, condition: 'NM', language: 'fr', ...overrides } as const;
}

async function apiErrorOf(promise: Promise<unknown>): Promise<ApiError> {
  const error: unknown = await promise.then(
    () => undefined,
    (reason: unknown) => reason,
  );
  if (!(error instanceof ApiError)) {
    throw new Error('ApiError attendue');
  }
  return error;
}

describe('handlers simulés des collections (contrat du back)', () => {
  it('liste les collections, les plus récentes d’abord', async () => {
    useMockCollections();

    const collections = await service.list();

    expect(collections.map(({ name }) => name)).toEqual(['Doubles à échanger', 'Classeur Base']);
  });

  it('pagine les cartes d’une collection avec les données du catalogue', async () => {
    useMockCollections();

    const page = await service.listCards(CLASSEUR_BASE, 1);

    expect(page).toMatchObject({ total: 2, page: 1, pageSize: 50 });
    expect(page.items.map(({ card }) => card.nameFr)).toEqual(['Pikachu', 'Tortank']);
  });

  it('ajoute une nouvelle ligne à chaque ajout, en tête de la collection', async () => {
    useMockCollections();
    const card = CHARIZARD?.card.id ?? '';

    const first = await service.addCard(DOUBLES, entryFor(card));
    const second = await service.addCard(DOUBLES, entryFor(card));
    const page = await service.listCards(DOUBLES, 1);

    expect(first.id).not.toBe(second.id);
    expect(page.total).toBe(2);
    expect(page.items[0]).toMatchObject({ id: second.id, card: CHARIZARD?.card });
  });

  it('accepte une impression de la carte', async () => {
    useMockCollections();
    const reverse = FURRET?.variants[1];

    const created = await service.addCard(
      DOUBLES,
      entryFor(FURRET?.card.id ?? '', { variantId: reverse?.id }),
    );

    expect(created.variantId).toBe(reverse?.id);
  });

  it.each([
    [
      'une quantité hors bornes',
      { quantity: 10000 },
      'Quantity must be an integer between 1 and 9999',
    ],
    ['un état inconnu', { condition: 'Mint' }, 'Condition must be one of: NM, LP, MP, HP, DMG'],
    ['une langue inconnue', { language: 'ja' }, 'Language must be one of: fr, en'],
    ['une carte mal formée', { cardId: 'dracaufeu' }, 'Card id must be a valid UUID'],
  ])('refuse %s par une 400 au format du back', async (_case, overrides, message) => {
    useMockCollections();

    const error = await apiErrorOf(
      service.addCard(DOUBLES, entryFor(CHARIZARD?.card.id ?? '', overrides)),
    );

    expect(error).toMatchObject({ status: 400, code: 'Bad Request', message });
  });

  it.each([
    ['une carte inconnue', DOUBLES, UNKNOWN_ID, 'Card or variant not found for this collection'],
    ['une collection inconnue', UNKNOWN_ID, CHARIZARD?.card.id ?? '', 'Collection not found'],
  ])('refuse %s par une 404', async (_case, collectionId, cardId, message) => {
    useMockCollections();

    const error = await apiErrorOf(service.addCard(collectionId, entryFor(cardId)));

    expect(error).toMatchObject({ status: 404, code: 'Not Found', message });
  });

  it('refuse un identifiant de collection mal formé', async () => {
    useMockCollections();

    const error = await apiErrorOf(service.listCards('classeur', 1));

    expect(error).toMatchObject({ status: 400, message: 'Collection id must be a valid UUID' });
  });
});
