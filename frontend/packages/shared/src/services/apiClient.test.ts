import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiError,
  createApiClient,
  DEFAULT_REQUEST_TIMEOUT_MS,
  INVALID_JSON_ERROR_CODE,
  NetworkError,
} from './apiClient';
import type {
  ApiClientOptions,
  ApiSession,
  FetchLike,
  FetchRequestInitLike,
  FetchResponseLike,
} from './apiClient';

/** Signal factice : les tests vérifient qu'il est transmis à fetch et annulé au bon moment. */
interface FakeSignal {
  aborted: boolean;
}

interface RecordedCall {
  url: string;
  init: FetchRequestInitLike<FakeSignal> | undefined;
  receiver: unknown;
}

function createHeaders(values: Record<string, string> = {}) {
  return { get: (name: string) => values[name] ?? null };
}

function jsonResponse(
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: createHeaders(headers),
    json: () => Promise.resolve(body),
  };
}

function invalidJsonResponse(status: number): FetchResponseLike {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: createHeaders(),
    json: () => Promise.reject(new SyntaxError('Unexpected token < in JSON')),
  };
}

/** Fetch factice qui renvoie les réponses dans l'ordre, la dernière étant répétée. */
function createFakeFetch(...responses: FetchResponseLike[]) {
  const calls: RecordedCall[] = [];
  const fetch: FetchLike<FakeSignal> = function (this: unknown, url, init) {
    calls.push({ url, init, receiver: this });
    const response = responses[Math.min(calls.length - 1, responses.length - 1)];
    return response ? Promise.resolve(response) : Promise.reject(new Error('Aucune réponse'));
  };
  return { fetch, calls };
}

function createFakeAbortController() {
  const signal: FakeSignal = { aborted: false };
  return {
    signal,
    abort: () => {
      signal.aborted = true;
    },
  };
}

function createClient(
  fetch: FetchLike<FakeSignal>,
  options: Partial<ApiClientOptions<FakeSignal>> = {},
) {
  return createApiClient({
    baseUrl: '/api/v1',
    fetch,
    createAbortController: createFakeAbortController,
    ...options,
  });
}

/** Session factice : `refresh` remplace le jeton par `nextToken` et renvoie `refreshResult`. */
function createFakeSession(
  initialToken: string | null,
  { nextToken = 'jeton-renouvele', refreshResult = true } = {},
) {
  let token = initialToken;
  const session = {
    getAccessToken: () => token,
    refresh: vi.fn(async () => {
      if (refreshResult) {
        token = nextToken;
      }
      return refreshResult;
    }),
    clear: vi.fn(() => {
      token = null;
    }),
  } satisfies ApiSession;
  return session;
}

function authorizationOf(call: RecordedCall | undefined): string | undefined {
  return call?.init?.headers?.Authorization;
}

describe('createApiClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('requête', () => {
    it("concatène l'URL de base et le chemin", async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch).request('/cards');

      expect(calls.map((call) => call.url)).toEqual(['/api/v1/cards']);
    });

    it("retire les / finaux de l'URL de base", async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));
      const client = createClient(fetch, { baseUrl: 'https://api.example.com/api/v1//' });

      await client.request('/cards');

      expect(calls.map((call) => call.url)).toEqual(['https://api.example.com/api/v1/cards']);
    });

    it('envoie un GET sans corps par défaut, avec le signal d’annulation', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch).request('/cards');

      expect(calls.map((call) => call.init)).toStrictEqual([
        { method: 'GET', headers: { Accept: 'application/json' }, signal: { aborted: false } },
      ]);
    });

    it('transmet la méthode demandée', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch).request('/cards/swsh3-136', { method: 'DELETE' });

      expect(calls.map((call) => call.init?.method)).toEqual(['DELETE']);
    });

    it('sérialise le corps en JSON avec le Content-Type', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(201));

      await createClient(fetch).request('/collection', {
        method: 'POST',
        body: { cardId: 'swsh3-136' },
      });

      expect(calls.map((call) => call.init)).toStrictEqual([
        {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
          body: '{"cardId":"swsh3-136"}',
          signal: { aborted: false },
        },
      ]);
    });

    it('envoie un corps null comme le texte "null" avec le Content-Type', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch).request('/collection', { method: 'PUT', body: null });

      expect(calls.map((call) => call.init?.body)).toEqual(['null']);
      expect(calls.map((call) => call.init?.headers?.['Content-Type'])).toEqual([
        'application/json',
      ]);
    });

    it('appelle le fetch injecté sans receveur', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch).request('/cards');

      expect(calls.map((call) => call.receiver)).toEqual([undefined]);
    });

    it('refuse à la compilation un chemin sans / initial', () => {
      const { fetch } = createFakeFetch(jsonResponse(200));
      const client = createClient(fetch);

      const requestWithoutSlash = () =>
        // @ts-expect-error le chemin doit commencer par "/"
        client.request('cards');

      expect(requestWithoutSlash).toBeTypeOf('function');
    });
  });

  describe('réponse', () => {
    it('renvoie le corps JSON de la réponse', async () => {
      const { fetch } = createFakeFetch(jsonResponse(200, [{ id: 'swsh3-136' }]));

      await expect(createClient(fetch).request('/cards')).resolves.toEqual([{ id: 'swsh3-136' }]);
    });

    it('renvoie undefined pour une réponse 204 sans lire le corps', async () => {
      const { fetch } = createFakeFetch({
        ok: true,
        status: 204,
        headers: createHeaders(),
        json: () => Promise.reject(new Error('Le corps ne doit pas être lu')),
      });

      await expect(
        createClient(fetch).request('/cards/swsh3-136', { method: 'DELETE' }),
      ).resolves.toBeUndefined();
    });

    it("rejette avec une ApiError quand une réponse 2xx n'est pas du JSON", async () => {
      const { fetch } = createFakeFetch(invalidJsonResponse(200));

      const request = createClient(fetch).request('/cards');

      await expect(request).rejects.toBeInstanceOf(ApiError);
      await expect(request).rejects.toMatchObject({
        name: 'ApiError',
        status: 200,
        code: INVALID_JSON_ERROR_CODE,
        message: expect.stringContaining('JSON attendu'),
      });
    });
  });

  describe('erreurs typées', () => {
    it('lit le code et le message du corps d’erreur du back', async () => {
      const { fetch } = createFakeFetch(
        jsonResponse(409, {
          statusCode: 409,
          error: 'Conflict',
          message: 'Email is already registered',
          timestamp: '2026-11-25T10:00:00.000Z',
          path: '/api/v1/auth/register',
        }),
      );

      const request = createClient(fetch).request('/auth/register', { method: 'POST' });

      await expect(request).rejects.toBeInstanceOf(ApiError);
      await expect(request).rejects.toMatchObject({
        name: 'ApiError',
        status: 409,
        code: 'Conflict',
        message: 'Email is already registered',
        body: expect.objectContaining({ error: 'Conflict' }),
      });
    });

    it('joint les messages d’une validation refusée', async () => {
      const { fetch } = createFakeFetch(
        jsonResponse(400, {
          error: 'Bad Request',
          message: ['email must be a string', 'password should not be empty'],
        }),
      );

      await expect(createClient(fetch).request('/auth/login')).rejects.toMatchObject({
        code: 'Bad Request',
        message: 'email must be a string ; password should not be empty',
      });
    });

    it('calcule le code et le message quand le corps d’erreur est inexploitable', async () => {
      const { fetch } = createFakeFetch(invalidJsonResponse(500));

      const request = createClient(fetch).request('/cards');

      await expect(request).rejects.toMatchObject({
        status: 500,
        code: 'HTTP_500',
        message: 'Requête GET /cards en échec (HTTP 500)',
      });
      await expect(request).rejects.toHaveProperty('body', undefined);
    });

    it('garde le statut quand la lecture du corps d’erreur échoue', async () => {
      const { fetch } = createFakeFetch({
        ok: false,
        status: 503,
        headers: createHeaders(),
        json: () => Promise.reject(new TypeError('Network request failed')),
      });

      const request = createClient(fetch).request('/cards');

      await expect(request).rejects.toBeInstanceOf(ApiError);
      await expect(request).rejects.toMatchObject({ status: 503 });
    });

    it('lit le délai d’attente dans l’en-tête Retry-After', async () => {
      const { fetch } = createFakeFetch(
        jsonResponse(429, { error: 'Too many requests' }, { 'Retry-After': '120' }),
      );

      await expect(createClient(fetch).request('/auth/login')).rejects.toMatchObject({
        status: 429,
        retryAfterSeconds: 120,
      });
    });

    it('ignore un Retry-After qui n’est pas un nombre de secondes', async () => {
      const { fetch } = createFakeFetch(
        jsonResponse(429, undefined, { 'Retry-After': 'Wed, 25 Nov 2026 10:00:00 GMT' }),
      );

      await expect(createClient(fetch).request('/auth/login')).rejects.toHaveProperty(
        'retryAfterSeconds',
        undefined,
      );
    });

    it('lève une NetworkError qui conserve l’erreur du fetch injecté', async () => {
      const networkError = new TypeError('Failed to fetch');
      const fetch: FetchLike<FakeSignal> = () => Promise.reject(networkError);

      const request = createClient(fetch).request('/cards');

      await expect(request).rejects.toBeInstanceOf(NetworkError);
      await expect(request).rejects.toMatchObject({
        name: 'NetworkError',
        reason: 'connection',
        cause: networkError,
      });
    });

    it('lève une NetworkError sur une coupure pendant la lecture du corps', async () => {
      const networkError = new TypeError('Network request failed');
      const { fetch } = createFakeFetch({
        ok: true,
        status: 200,
        headers: createHeaders(),
        json: () => Promise.reject(networkError),
      });

      await expect(createClient(fetch).request('/cards')).rejects.toMatchObject({
        name: 'NetworkError',
        reason: 'connection',
        cause: networkError,
      });
    });
  });

  describe('délai maximal', () => {
    it('annule la requête et lève une NetworkError après 15 s par défaut', async () => {
      vi.useFakeTimers();
      const controller = createFakeAbortController();
      const fetch: FetchLike<FakeSignal> = () => new Promise(() => {});
      const client = createClient(fetch, { createAbortController: () => controller });

      const request = client.request('/cards');
      const outcome = expect(request).rejects.toMatchObject({
        name: 'NetworkError',
        reason: 'timeout',
      });
      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS - 1);
      expect(controller.signal.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);

      await outcome;
      expect(controller.signal.aborted).toBe(true);
    });

    it('applique le délai demandé', async () => {
      vi.useFakeTimers();
      const fetch: FetchLike<FakeSignal> = () => new Promise(() => {});

      const request = createClient(fetch, { timeoutMs: 500 }).request('/cards');
      const outcome = expect(request).rejects.toMatchObject({ reason: 'timeout' });
      await vi.advanceTimersByTimeAsync(500);

      await outcome;
    });

    it('n’annule plus une requête déjà aboutie', async () => {
      vi.useFakeTimers();
      const controller = createFakeAbortController();
      const { fetch } = createFakeFetch(jsonResponse(200, { id: 1 }));
      const client = createClient(fetch, { createAbortController: () => controller });

      await expect(client.request('/cards')).resolves.toEqual({ id: 1 });
      await vi.advanceTimersByTimeAsync(DEFAULT_REQUEST_TIMEOUT_MS);

      expect(controller.signal.aborted).toBe(false);
    });
  });

  describe('session', () => {
    it('envoie le jeton d’accès de la session en Bearer', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch, { session: createFakeSession('jeton-acces') }).request('/users/me');

      expect(calls.map(authorizationOf)).toEqual(['Bearer jeton-acces']);
    });

    it('n’envoie pas d’Authorization sans jeton', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(200));

      await createClient(fetch, { session: createFakeSession(null) }).request('/cards');
      await createClient(fetch).request('/cards');

      expect(calls.map(authorizationOf)).toEqual([undefined, undefined]);
    });

    it('renouvelle la session sur un 401 puis rejoue la requête avec le nouveau jeton', async () => {
      const { fetch, calls } = createFakeFetch(
        jsonResponse(401, { error: 'Unauthorized' }),
        jsonResponse(200, { username: 'ash' }),
      );
      const session = createFakeSession('jeton-expire');

      await expect(createClient(fetch, { session }).request('/users/me')).resolves.toEqual({
        username: 'ash',
      });

      expect(session.refresh).toHaveBeenCalledTimes(1);
      expect(calls.map(authorizationOf)).toEqual(['Bearer jeton-expire', 'Bearer jeton-renouvele']);
    });

    it('ne fait qu’un refresh pour des 401 simultanés, puis rejoue chaque requête', async () => {
      let releaseRefresh: (refreshed: boolean) => void = () => {
        throw new Error('Refresh non démarré');
      };
      let token = 'jeton-expire';
      const session = {
        getAccessToken: () => token,
        refresh: vi.fn(
          () =>
            new Promise<boolean>((resolve) => {
              releaseRefresh = (refreshed) => {
                token = 'jeton-renouvele';
                resolve(refreshed);
              };
            }),
        ),
        clear: vi.fn(),
      } satisfies ApiSession;
      const fetch: FetchLike<FakeSignal> = (_url, init) =>
        Promise.resolve(
          init?.headers?.Authorization === 'Bearer jeton-renouvele'
            ? jsonResponse(200, 'ok')
            : jsonResponse(401),
        );
      const client = createClient(fetch, { session });

      const requests = Promise.all([
        client.request('/collections'),
        client.request('/users/me'),
        client.request('/cards'),
      ]);
      await vi.waitFor(() => expect(session.refresh).toHaveBeenCalled());
      releaseRefresh(true);

      await expect(requests).resolves.toEqual(['ok', 'ok', 'ok']);
      expect(session.refresh).toHaveBeenCalledTimes(1);
      expect(session.clear).not.toHaveBeenCalled();
    });

    it('vide la session une seule fois quand le refresh est refusé', async () => {
      const { fetch } = createFakeFetch(jsonResponse(401, { error: 'Unauthorized' }));
      const session = createFakeSession('jeton-expire', { refreshResult: false });
      const client = createClient(fetch, { session });

      const requests = [client.request('/collections'), client.request('/users/me')];

      for (const request of requests) {
        await expect(request).rejects.toMatchObject({ name: 'ApiError', status: 401 });
      }
      expect(session.refresh).toHaveBeenCalledTimes(1);
      expect(session.clear).toHaveBeenCalledTimes(1);
    });

    it('garde la session quand le refresh échoue sur une erreur réseau', async () => {
      const { fetch } = createFakeFetch(jsonResponse(401));
      const session = createFakeSession('jeton-expire');
      session.refresh.mockRejectedValueOnce(new NetworkError('connection', 'Serveur injoignable'));

      await expect(createClient(fetch, { session }).request('/users/me')).rejects.toBeInstanceOf(
        NetworkError,
      );
      expect(session.clear).not.toHaveBeenCalled();
    });

    it('ne renouvelle pas une seconde fois si la requête rejouée reçoit encore un 401', async () => {
      const { fetch, calls } = createFakeFetch(jsonResponse(401));
      const session = createFakeSession('jeton-expire');

      await expect(createClient(fetch, { session }).request('/users/me')).rejects.toMatchObject({
        status: 401,
      });
      expect(session.refresh).toHaveBeenCalledTimes(1);
      expect(calls).toHaveLength(2);
    });

    it('rejoue sans refresh quand le jeton a déjà été renouvelé entre-temps', async () => {
      let token = 'jeton-expire';
      const session = {
        getAccessToken: () => token,
        refresh: vi.fn(async () => true),
        clear: vi.fn(),
      } satisfies ApiSession;
      const fetch: FetchLike<FakeSignal> = (_url, init) => {
        const authorization = init?.headers?.Authorization;
        token = 'jeton-renouvele';
        return Promise.resolve(
          authorization === 'Bearer jeton-renouvele' ? jsonResponse(200, 'ok') : jsonResponse(401),
        );
      };

      await expect(createClient(fetch, { session }).request('/users/me')).resolves.toBe('ok');
      expect(session.refresh).not.toHaveBeenCalled();
    });

    it.each(['/auth/login', '/auth/refresh'] as const)(
      'ne renouvelle pas la session sur un 401 de %s',
      async (path) => {
        const { fetch, calls } = createFakeFetch(jsonResponse(401, { error: 'Unauthorized' }));
        const session = createFakeSession('jeton-acces');

        await expect(
          createClient(fetch, { session }).request(path, { method: 'POST' }),
        ).rejects.toMatchObject({ status: 401, code: 'Unauthorized' });
        expect(session.refresh).not.toHaveBeenCalled();
        expect(calls).toHaveLength(1);
      },
    );

    it('ne renouvelle pas la session pour une requête envoyée sans jeton', async () => {
      const { fetch } = createFakeFetch(jsonResponse(401));
      const session = createFakeSession(null);

      await expect(createClient(fetch, { session }).request('/users/me')).rejects.toMatchObject({
        status: 401,
      });
      expect(session.refresh).not.toHaveBeenCalled();
    });
  });
});
