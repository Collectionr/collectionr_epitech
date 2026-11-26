import { describe, expect, it, vi } from 'vitest';

import {
  cardEntry,
  cardEntryView,
  cardsPage,
  TEST_COLLECTION,
} from '../hooks/mocks/createCollectionHarness';
import { ApiError } from './apiClient';
import type { ApiClient } from './apiClient';
import { createCollectionService } from './collectionService';

function serviceReturning(body: unknown) {
  const client = { request: vi.fn(async () => body) } satisfies ApiClient;
  return { client, service: createCollectionService({ client }) };
}

/** Page dont l'unique ligne a des champs remplacés par des valeurs hors contrat. */
function pageWith(fields: Record<string, unknown>): unknown {
  return { items: [{ ...cardEntryView(), ...fields }], total: 1, page: 1, pageSize: 50 };
}

const ENTRY_INPUT = {
  cardId: '09a987ad-21e7-45c5-9b66-e39e92ae5464',
  quantity: 2,
  condition: 'LP',
  language: 'en',
} as const;

describe('collectionService.list', () => {
  it('renvoie les collections de l’utilisateur', async () => {
    const { client, service } = serviceReturning([TEST_COLLECTION]);

    await expect(service.list()).resolves.toEqual([TEST_COLLECTION]);
    expect(client.request).toHaveBeenCalledWith('/collections');
  });

  it.each([
    ['un objet au lieu d’une liste', { items: [] }],
    ['une collection sans nom', [{ ...TEST_COLLECTION, name: undefined }]],
  ])('refuse %s', async (_case, body) => {
    const { service } = serviceReturning(body);

    await expect(service.list()).rejects.toThrow('Réponse inattendue de /collections');
  });

  it('laisse remonter l’erreur de l’API', async () => {
    const error = new ApiError({ status: 401, code: 'Unauthorized', message: 'Unauthorized' });
    const client = { request: vi.fn(() => Promise.reject(error)) } satisfies ApiClient;

    await expect(createCollectionService({ client }).list()).rejects.toBe(error);
  });
});

describe('collectionService.listCards', () => {
  it('demande la page voulue, 50 lignes par page, avec l’identifiant encodé', async () => {
    const page = cardsPage([cardEntryView()], 2, 51);
    const { client, service } = serviceReturning(page);

    await expect(service.listCards('base set/1', 2)).resolves.toEqual(page);
    expect(client.request).toHaveBeenCalledWith(
      '/collections/base%20set%2F1/cards?page=2&pageSize=50',
    );
  });

  it('lit l’impression d’une ligne quand elle est connue', async () => {
    const variant = {
      id: '1f37930e-2688-49c9-8e94-e5d265bad764',
      type: 'holo',
      subtype: 'unlimited',
      size: 'standard',
      stamps: ['1st-edition'],
      foil: null,
    };
    const { service } = serviceReturning(cardsPage([cardEntryView({ variant })]));

    const page = await service.listCards(TEST_COLLECTION.id, 1);

    expect(page.items[0]?.variant).toEqual(variant);
  });

  it.each([
    ['sans liste de lignes', { total: 0, page: 1, pageSize: 50 }],
    ['sans total', { items: [], page: 1, pageSize: 50 }],
    ['avec une carte incomplète', pageWith({ card: { id: 'x' } })],
    ['avec un set absent', pageWith({ set: null })],
    ['avec un état inconnu', pageWith({ condition: 'Mint' })],
    ['avec une impression sans tampons', pageWith({ variant: { id: 'v', type: 'holo' } })],
  ])('refuse une page %s', async (_case, body) => {
    const { service } = serviceReturning(body);

    await expect(service.listCards(TEST_COLLECTION.id, 1)).rejects.toThrow(
      `Réponse inattendue de /collections/${TEST_COLLECTION.id}/cards`,
    );
  });
});

describe('collectionService.addCard', () => {
  it('envoie la carte, la quantité, l’état et la langue, sans impression inconnue', async () => {
    const created = cardEntry({ quantity: 2, condition: 'LP', language: 'en' });
    const { client, service } = serviceReturning(created);

    await expect(service.addCard(TEST_COLLECTION.id, ENTRY_INPUT)).resolves.toEqual(created);
    expect(client.request).toHaveBeenCalledWith(`/collections/${TEST_COLLECTION.id}/cards`, {
      method: 'POST',
      body: ENTRY_INPUT,
    });
  });

  it('envoie l’impression quand elle est choisie', async () => {
    const variantId = '1f37930e-2688-49c9-8e94-e5d265bad764';
    const { client, service } = serviceReturning(cardEntry({ variantId }));

    await service.addCard(TEST_COLLECTION.id, { ...ENTRY_INPUT, variantId });

    expect(client.request).toHaveBeenCalledWith(`/collections/${TEST_COLLECTION.id}/cards`, {
      method: 'POST',
      body: { ...ENTRY_INPUT, variantId },
    });
  });

  it.each([
    ['une quantité en texte', { ...cardEntry(), quantity: '2' }],
    ['une langue inconnue', { ...cardEntry(), language: 'ja' }],
    ['une note de gradage absente', { ...cardEntry(), gradingNote: undefined }],
  ])('refuse une ligne avec %s', async (_case, body) => {
    const { service } = serviceReturning(body);

    await expect(service.addCard(TEST_COLLECTION.id, ENTRY_INPUT)).rejects.toThrow(TypeError);
  });
});
