// @vitest-environment node
// fetch de Node (undici) refuse le signal d'annulation de jsdom : ce test d'intégration tourne sous Node.
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError, createApiClient, createCatalogService } from '@shared/services';

import { createCatalogueHandlers } from './catalogueHandlers';

const BASE_URL = 'http://localhost/api/v1';

const server = setupServer(...createCatalogueHandlers(BASE_URL));
const client = createApiClient({
  baseUrl: BASE_URL,
  // Lu à chaque appel : MSW remplace le fetch global au démarrage du serveur, après cet import.
  fetch: (url, init) => fetch(url, init),
  createAbortController: () => new AbortController(),
});
const service = createCatalogService({ client });

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

async function namesFound(term: string): Promise<string[]> {
  const cards = await service.search(term);
  return cards.map(({ card }) => card.nameEn);
}

describe('handler simulé de la recherche dans le catalogue', () => {
  it('trouve par le nom français, trié par nom anglais', async () => {
    await expect(namesFound('dracaufeu')).resolves.toEqual([
      'Charizard',
      'Charizard ex',
      'Charizard VMAX',
    ]);
  });

  it('trouve par le nom anglais, sans tenir compte de la casse', async () => {
    await expect(namesFound('BLASTO')).resolves.toEqual(['Blastoise']);
  });

  it('départage deux noms identiques par l’identifiant TCGdex', async () => {
    const cards = await service.search('pikachu');

    expect(cards.map(({ set, card }) => `${set.tcgdexId}-${card.number}`)).toEqual([
      'base1-58',
      'sv03.5-025',
    ]);
  });

  it('renvoie chaque carte avec son set et ses impressions', async () => {
    const [furret] = await service.search('fouinar');

    expect(furret?.set.nameFr).toBe('Ténèbres Embrasées');
    expect(furret?.variants.map(({ type }) => type)).toEqual(['normal', 'reverse']);
  });

  it('renvoie une liste vide sans carte correspondante', async () => {
    await expect(service.search('zzz')).resolves.toEqual([]);
  });

  it.each([
    [
      'un terme trop court',
      'q=d&limit=20',
      'The search term must be between 2 and 100 characters long',
    ],
    [
      'une limite trop grande',
      'q=pika&limit=51',
      'The search limit must be a whole number between 1 and 50',
    ],
  ])('refuse %s par une 400 au format du back', async (_case, query, message) => {
    const error: unknown = await client
      .request(`/catalogue/cards/search?${query}`)
      .catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: 'Bad Request', message });
  });
});
