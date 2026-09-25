import { describe, expect, it } from 'vitest';

import { ApiError, createApiClient } from './apiClient';
import type { FetchLike, FetchRequestInitLike, FetchResponseLike } from './apiClient';

interface RecordedCall {
  url: string;
  init: FetchRequestInitLike | undefined;
  receiver: unknown;
}

function jsonResponse(status: number, body?: unknown): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function createFakeFetch(response: FetchResponseLike) {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike = function (this: unknown, url, init) {
    calls.push({ url, init, receiver: this });
    return Promise.resolve(response);
  };
  return { fetch, calls };
}

describe('createApiClient', () => {
  it("concatène l'URL de base et le chemin", async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await client.request('/cards');

    expect(calls.map((call) => call.url)).toEqual(['/api/v1/cards']);
  });

  it("retire les / finaux de l'URL de base", async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: 'https://api.example.com/api/v1//', fetch });

    await client.request('/cards');

    expect(calls.map((call) => call.url)).toEqual(['https://api.example.com/api/v1/cards']);
  });

  it('envoie un GET sans corps par défaut', async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await client.request('/cards');

    expect(calls.map((call) => call.init)).toStrictEqual([
      { method: 'GET', headers: { Accept: 'application/json' } },
    ]);
  });

  it('transmet la méthode demandée', async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await client.request('/cards/swsh3-136', { method: 'DELETE' });

    expect(calls.map((call) => call.init?.method)).toEqual(['DELETE']);
  });

  it('sérialise le corps en JSON avec le Content-Type', async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(201));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await client.request('/collection', { method: 'POST', body: { cardId: 'swsh3-136' } });

    expect(calls.map((call) => call.init)).toStrictEqual([
      {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: '{"cardId":"swsh3-136"}',
      },
    ]);
  });

  it('envoie un corps null comme le texte "null" avec le Content-Type', async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await client.request('/collection', { method: 'PUT', body: null });

    expect(calls.map((call) => call.init)).toStrictEqual([
      {
        method: 'PUT',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: 'null',
      },
    ]);
  });

  it('renvoie le corps JSON de la réponse', async () => {
    const { fetch } = createFakeFetch(jsonResponse(200, [{ id: 'swsh3-136' }]));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await expect(client.request('/cards')).resolves.toEqual([{ id: 'swsh3-136' }]);
  });

  it('renvoie undefined pour une réponse 204 sans lire le corps', async () => {
    const { fetch } = createFakeFetch({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('Le corps ne doit pas être lu')),
    });
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await expect(client.request('/cards/swsh3-136', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('rejette avec une ApiError portant le statut HTTP quand la réponse est en échec', async () => {
    const { fetch } = createFakeFetch(jsonResponse(404));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    const request = client.request('/cards/inconnue');

    await expect(request).rejects.toBeInstanceOf(ApiError);
    await expect(request).rejects.toMatchObject({ name: 'ApiError', status: 404 });
  });

  it("propage l'erreur réseau du fetch injecté", async () => {
    const networkError = new TypeError('Failed to fetch');
    const fetch: FetchLike = () => Promise.reject(networkError);
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await expect(client.request('/cards')).rejects.toBe(networkError);
  });

  it('appelle le fetch injecté sans receveur', async () => {
    const { fetch, calls } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    await client.request('/cards');

    expect(calls.map((call) => call.receiver)).toEqual([undefined]);
  });

  it('refuse à la compilation un chemin sans / initial', () => {
    const { fetch } = createFakeFetch(jsonResponse(200));
    const client = createApiClient({ baseUrl: '/api/v1', fetch });

    const requestWithoutSlash = () =>
      // @ts-expect-error le chemin doit commencer par "/"
      client.request('cards');

    expect(requestWithoutSlash).toBeTypeOf('function');
  });
});
