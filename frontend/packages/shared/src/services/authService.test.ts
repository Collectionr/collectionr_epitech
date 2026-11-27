import { describe, expect, it, vi } from 'vitest';

import { createAuthStore } from '../stores';
import type { User } from '../types';
import { ApiError, createApiClient, NetworkError } from './apiClient';
import type { ApiClient, ApiPath, ApiRequestOptions, FetchLike } from './apiClient';
import { createAuthService, createAuthSession, SessionClosedError } from './authService';
import type { RunExclusive, TokenStorage } from './authService';

const USER: User = {
  id: '0b6c3f1e-6d5a-4c1b-9a8e-2f4d7c9b1a00',
  email: 'ash@exemple.fr',
  username: 'ash',
  createdAt: '2026-09-27T12:00:00.000Z',
};

function createMemoryStorage(initialToken: string | null = null) {
  let token = initialToken;
  return {
    current: () => token,
    getRefreshToken: vi.fn(async () => token),
    setRefreshToken: vi.fn(async (refreshToken: string) => {
      token = refreshToken;
    }),
    clearRefreshToken: vi.fn(async () => {
      token = null;
    }),
  } satisfies TokenStorage & { current: () => string | null };
}

type Handler = (options: ApiRequestOptions | undefined) => Promise<unknown>;

/** Client factice : chaque chemin a son gestionnaire ; un chemin inattendu fait échouer le test. */
function createFakeClient(handlers: Partial<Record<ApiPath, Handler>>) {
  const request = vi.fn((path: ApiPath, options?: ApiRequestOptions) => {
    const handler = handlers[path];
    return handler ? handler(options) : Promise.reject(new Error(`Appel inattendu : ${path}`));
  });
  return { request } satisfies ApiClient;
}

function apiError(status: number, message = 'Back message'): ApiError {
  return new ApiError({ status, code: `HTTP_${status}`, message });
}

function setup(
  handlers: Partial<Record<ApiPath, Handler>>,
  {
    storedToken = null as string | null,
    runExclusive = undefined as RunExclusive | undefined,
  } = {},
) {
  const client = createFakeClient(handlers);
  const storage = createMemoryStorage(storedToken);
  const store = createAuthStore();
  const authService = createAuthService({ client, storage, store, runExclusive });
  return { client, storage, store, authService };
}

const ROTATED_TOKENS = { accessToken: 'acces-2', refreshToken: 'renouvellement-2' };

describe('createAuthService', () => {
  describe('login', () => {
    it('ouvre la session et enregistre le jeton de renouvellement', async () => {
      const { client, storage, store, authService } = setup({
        '/auth/login': async () => ({
          user: USER,
          accessToken: 'acces-1',
          refreshToken: 'renouvellement-1',
        }),
      });

      await expect(
        authService.login({ email: 'ash@exemple.fr', password: 'pikachu25' }),
      ).resolves.toEqual(USER);

      expect(client.request).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: { email: 'ash@exemple.fr', password: 'pikachu25' },
      });
      expect(storage.current()).toBe('renouvellement-1');
      expect(store.getState()).toMatchObject({
        status: 'authenticated',
        user: USER,
        accessToken: 'acces-1',
      });
    });

    it('laisse la session fermée et propage l’erreur en cas d’échec', async () => {
      const { storage, store, authService } = setup({
        '/auth/login': () => Promise.reject(apiError(401, 'Invalid email or password')),
      });

      await expect(authService.login({ email: 'ash@exemple.fr', password: 'x' })).rejects.toThrow(
        'Invalid email or password',
      );
      expect(storage.current()).toBeNull();
      expect(store.getState().status).toBe('unknown');
    });

    it('refuse une réponse sans jetons', async () => {
      const { storage, authService } = setup({ '/auth/login': async () => ({ user: USER }) });

      await expect(authService.login({ email: 'ash@exemple.fr', password: 'x' })).rejects.toThrow(
        'Réponse inattendue de /auth/login',
      );
      expect(storage.current()).toBeNull();
    });
  });

  describe('register', () => {
    it('crée le compte sans ouvrir de session', async () => {
      const input = {
        email: 'ash@exemple.fr',
        password: 'pikachu25',
        username: 'ash',
        acceptedTermsVersion: '1',
      };
      const { client, store, authService } = setup({ '/auth/register': async () => USER });

      await expect(authService.register(input)).resolves.toEqual(USER);

      expect(client.request).toHaveBeenCalledWith('/auth/register', {
        method: 'POST',
        body: input,
      });
      expect(store.getState().status).toBe('unknown');
    });

    it('refuse un utilisateur incomplet', async () => {
      const { authService } = setup({ '/auth/register': async () => ({ id: USER.id }) });

      await expect(
        authService.register({
          email: 'a@b.fr',
          password: 'pikachu25',
          username: 'ash',
          acceptedTermsVersion: '1',
        }),
      ).rejects.toThrow('Réponse inattendue de /auth/register');
    });
  });

  describe('refresh', () => {
    it('présente le jeton enregistré et enregistre la nouvelle paire', async () => {
      const { client, storage, store, authService } = setup(
        { '/auth/refresh': async () => ROTATED_TOKENS },
        { storedToken: 'renouvellement-1' },
      );

      await expect(authService.refresh()).resolves.toBe(true);

      expect(client.request).toHaveBeenCalledWith('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: 'renouvellement-1' },
      });
      expect(storage.current()).toBe('renouvellement-2');
      expect(store.getState().accessToken).toBe('acces-2');
    });

    it('renvoie false sans appel quand aucun jeton n’est enregistré', async () => {
      const { client, authService } = setup({});

      await expect(authService.refresh()).resolves.toBe(false);
      expect(client.request).not.toHaveBeenCalled();
    });

    it.each([401, 400])('renvoie false quand le back refuse le jeton (%i)', async (status) => {
      const { authService } = setup(
        { '/auth/refresh': () => Promise.reject(apiError(status)) },
        { storedToken: 'renouvellement-1' },
      );

      await expect(authService.refresh()).resolves.toBe(false);
    });

    it('propage une erreur réseau et conserve le jeton', async () => {
      const { storage, authService } = setup(
        {
          '/auth/refresh': () => Promise.reject(new NetworkError('connection', 'Failed to fetch')),
        },
        { storedToken: 'renouvellement-1' },
      );

      await expect(authService.refresh()).rejects.toBeInstanceOf(NetworkError);
      expect(storage.current()).toBe('renouvellement-1');
    });

    it('propage un 429 et conserve le jeton', async () => {
      const { storage, authService } = setup(
        { '/auth/refresh': () => Promise.reject(apiError(429)) },
        { storedToken: 'renouvellement-1' },
      );

      await expect(authService.refresh()).rejects.toMatchObject({ status: 429 });
      expect(storage.current()).toBe('renouvellement-1');
    });

    it('ne fait qu’un appel pour des renouvellements simultanés', async () => {
      const { client, authService } = setup(
        { '/auth/refresh': async () => ROTATED_TOKENS },
        { storedToken: 'renouvellement-1' },
      );

      await expect(Promise.all([authService.refresh(), authService.refresh()])).resolves.toEqual([
        true,
        true,
      ]);
      expect(client.request).toHaveBeenCalledTimes(1);
    });

    it('relit le jeton dans le stockage, sous l’exclusion entre onglets', async () => {
      const events: string[] = [];
      const runExclusive: RunExclusive = async (task) => {
        events.push('verrou pris');
        const result = await task();
        events.push('verrou rendu');
        return result;
      };
      const { client, storage, authService } = setup(
        { '/auth/refresh': async () => ROTATED_TOKENS },
        { storedToken: 'renouvellement-1', runExclusive },
      );
      // Un autre onglet a renouvelé la paire entre-temps : c'est son jeton qui doit partir.
      await storage.setRefreshToken('renouvellement-autre-onglet');
      storage.getRefreshToken.mockImplementationOnce(async () => {
        events.push('jeton relu');
        return storage.current();
      });

      await authService.refresh();

      expect(events).toEqual(['verrou pris', 'jeton relu', 'verrou rendu']);
      expect(client.request).toHaveBeenCalledWith('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: 'renouvellement-autre-onglet' },
      });
    });
  });

  describe('restoreSession', () => {
    it('ouvre la session après le renouvellement et la lecture du profil', async () => {
      const { client, store, authService } = setup(
        { '/auth/refresh': async () => ROTATED_TOKENS, '/users/me': async () => USER },
        { storedToken: 'renouvellement-1' },
      );

      await authService.restoreSession();

      expect(client.request.mock.calls.map(([path]) => path)).toEqual([
        '/auth/refresh',
        '/users/me',
      ]);
      expect(store.getState()).toMatchObject({
        status: 'authenticated',
        user: USER,
        accessToken: 'acces-2',
        endReason: null,
        restoreError: null,
      });
    });

    it('passe en anonyme sans appel quand aucun jeton n’est enregistré', async () => {
      const { client, store, authService } = setup({});

      await authService.restoreSession();

      expect(client.request).not.toHaveBeenCalled();
      expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: null });
    });

    it('supprime un jeton refusé et passe en anonyme, sans parler d’expiration', async () => {
      const { storage, store, authService } = setup(
        { '/auth/refresh': () => Promise.reject(apiError(401)) },
        { storedToken: 'renouvellement-revoque' },
      );

      await authService.restoreSession();

      expect(storage.current()).toBeNull();
      expect(store.getState()).toMatchObject({
        status: 'anonymous',
        endReason: null,
        restoreError: null,
      });
    });

    it.each([
      ['un serveur injoignable', new NetworkError('connection', 'Failed to fetch')],
      ['un délai dépassé', new NetworkError('timeout', 'Timeout')],
      ['une erreur 503', apiError(503)],
      ['une limite de débit (429)', apiError(429)],
    ])(
      'garde la session indéterminée et le jeton sur %s au renouvellement',
      async (_label, error) => {
        const { storage, store, authService } = setup(
          { '/auth/refresh': () => Promise.reject(error) },
          { storedToken: 'renouvellement-1' },
        );

        await authService.restoreSession();

        expect(storage.current()).toBe('renouvellement-1');
        expect(store.getState()).toMatchObject({ status: 'unknown', restoreError: error });
      },
    );

    it('garde la session indéterminée quand le profil échoue côté serveur', async () => {
      const error = apiError(500);
      const { store, authService } = setup(
        {
          '/auth/refresh': async () => ROTATED_TOKENS,
          '/users/me': () => Promise.reject(error),
        },
        { storedToken: 'renouvellement-1' },
      );

      await authService.restoreSession();

      expect(store.getState()).toMatchObject({ status: 'unknown', restoreError: error });
    });

    it.each([401, 404])(
      'passe en anonyme et supprime le jeton quand le profil est refusé (%i)',
      async (status) => {
        const { storage, store, authService } = setup(
          {
            '/auth/refresh': async () => ROTATED_TOKENS,
            '/users/me': () => Promise.reject(apiError(status)),
          },
          { storedToken: 'renouvellement-1' },
        );

        await authService.restoreSession();

        expect(storage.current()).toBeNull();
        expect(store.getState()).toMatchObject({ status: 'anonymous', restoreError: null });
      },
    );

    it('relance la restauration après un échec, en effaçant l’erreur', async () => {
      let attempts = 0;
      const { store, authService } = setup(
        {
          '/auth/refresh': async () => {
            attempts += 1;
            if (attempts === 1) {
              throw new NetworkError('connection', 'Failed to fetch');
            }
            return ROTATED_TOKENS;
          },
          '/users/me': async () => USER,
        },
        { storedToken: 'renouvellement-1' },
      );
      await authService.restoreSession();
      expect(store.getState().restoreError).toBeInstanceOf(NetworkError);

      const retry = authService.restoreSession();
      expect(store.getState().restoreError).toBeNull();
      await retry;

      expect(store.getState()).toMatchObject({ status: 'authenticated', restoreError: null });
    });

    it('ne restaure qu’une fois, même appelée deux fois (StrictMode)', async () => {
      const { client, authService } = setup(
        { '/auth/refresh': async () => ROTATED_TOKENS, '/users/me': async () => USER },
        { storedToken: 'renouvellement-1' },
      );

      await Promise.all([authService.restoreSession(), authService.restoreSession()]);
      await authService.restoreSession();

      expect(client.request).toHaveBeenCalledTimes(2);
    });
  });

  describe('logout', () => {
    it('révoque le jeton auprès du back puis ferme la session', async () => {
      const { client, storage, store, authService } = setup(
        { '/auth/logout': async () => undefined },
        { storedToken: 'renouvellement-1' },
      );
      store.getState().startSession(USER, 'acces-1');

      await authService.logout();

      expect(client.request).toHaveBeenCalledWith('/auth/logout', {
        method: 'POST',
        body: { refreshToken: 'renouvellement-1' },
      });
      expect(storage.current()).toBeNull();
      expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: 'logout' });
    });

    it('ferme la session localement même si le back est injoignable, puis propage l’erreur', async () => {
      const { storage, store, authService } = setup(
        {
          '/auth/logout': () => Promise.reject(new NetworkError('connection', 'Failed to fetch')),
        },
        { storedToken: 'renouvellement-1' },
      );
      store.getState().startSession(USER, 'acces-1');

      await expect(authService.logout()).rejects.toBeInstanceOf(NetworkError);
      expect(storage.current()).toBeNull();
      expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: 'logout' });
    });

    it('ferme la session sans appel quand aucun jeton n’est enregistré', async () => {
      const { client, store, authService } = setup({});
      store.getState().startSession(USER, 'acces-1');

      await authService.logout();

      expect(client.request).not.toHaveBeenCalled();
      expect(store.getState().status).toBe('anonymous');
    });
  });

  describe('clearSession', () => {
    it('signale l’expiration d’une session ouverte et supprime le jeton', async () => {
      const { storage, store, authService } = setup({}, { storedToken: 'renouvellement-1' });
      store.getState().startSession(USER, 'acces-1');

      await authService.clearSession();

      expect(storage.current()).toBeNull();
      expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: 'expired' });
    });

    it('ne parle pas d’expiration quand aucune session n’était ouverte', async () => {
      const { store, authService } = setup({});

      await authService.clearSession();

      expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: null });
    });
  });
});

/** Promesse résolue à la demande, pour faire arriver une réponse au moment choisi. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Promesse non créée');
  };
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

describe('génération de session', () => {
  function connected(handlers: Parameters<typeof setup>[0]) {
    const context = setup(handlers, { storedToken: 'renouvellement-1' });
    context.store.getState().startSession(USER, 'acces-1');
    return context;
  }

  it('ignore un refresh qui arrive après une déconnexion réussie', async () => {
    const refreshResponse = deferred<unknown>();
    const { storage, store, authService } = connected({
      '/auth/refresh': () => refreshResponse.promise,
      '/auth/logout': async () => undefined,
    });

    const refresh = authService.refresh();
    await vi.waitFor(() => expect(storage.getRefreshToken).toHaveBeenCalled());
    await authService.logout();
    refreshResponse.resolve(ROTATED_TOKENS);

    await expect(refresh).resolves.toBe(false);
    expect(storage.current()).toBeNull();
    expect(store.getState()).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      endReason: 'logout',
    });
  });

  it('ignore un refresh qui arrive après une déconnexion en erreur réseau', async () => {
    const refreshResponse = deferred<unknown>();
    const { storage, store, authService } = connected({
      '/auth/refresh': () => refreshResponse.promise,
      '/auth/logout': () => Promise.reject(new NetworkError('connection', 'Failed to fetch')),
    });

    const refresh = authService.refresh();
    await vi.waitFor(() => expect(storage.getRefreshToken).toHaveBeenCalled());
    await expect(authService.logout()).rejects.toBeInstanceOf(NetworkError);
    refreshResponse.resolve(ROTATED_TOKENS);

    await expect(refresh).resolves.toBe(false);
    expect(storage.current()).toBeNull();
    expect(store.getState()).toMatchObject({
      status: 'anonymous',
      accessToken: null,
      endReason: 'logout',
    });
  });

  it('ferme la session avant de révoquer le jeton auprès du back', async () => {
    const logoutResponse = deferred<unknown>();
    const { client, storage, store, authService } = connected({
      '/auth/logout': () => logoutResponse.promise,
    });

    const logout = authService.logout();
    await vi.waitFor(() => expect(client.request).toHaveBeenCalled());

    expect(store.getState().status).toBe('anonymous');
    expect(storage.current()).toBeNull();
    expect(client.request).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      body: { refreshToken: 'renouvellement-1' },
    });
    logoutResponse.resolve(undefined);
    await logout;
  });

  it('refuse une connexion dont la réponse arrive après une fermeture de session', async () => {
    const loginResponse = deferred<unknown>();
    const { storage, store, authService } = setup({ '/auth/login': () => loginResponse.promise });

    const login = authService.login({ email: 'ash@exemple.fr', password: 'pikachu25' });
    await authService.clearSession();
    loginResponse.resolve({ user: USER, ...ROTATED_TOKENS });

    await expect(login).rejects.toBeInstanceOf(SessionClosedError);
    expect(storage.current()).toBeNull();
    expect(store.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('n’ouvre pas une session restaurée après sa fermeture', async () => {
    const refreshResponse = deferred<unknown>();
    const { client, storage, store, authService } = setup(
      { '/auth/refresh': () => refreshResponse.promise, '/users/me': async () => USER },
      { storedToken: 'renouvellement-1' },
    );

    const restoration = authService.restoreSession();
    await vi.waitFor(() => expect(client.request).toHaveBeenCalled());
    await authService.clearSession();
    refreshResponse.resolve(ROTATED_TOKENS);
    await restoration;

    expect(storage.current()).toBeNull();
    expect(store.getState()).toMatchObject({ status: 'anonymous', accessToken: null, user: null });
    expect(client.request).not.toHaveBeenCalledWith('/users/me');
  });

  it('efface le jeton écrit pendant une fermeture de session', async () => {
    const { storage, store, authService } = connected({
      '/auth/refresh': async () => ROTATED_TOKENS,
    });
    // La session est fermée pendant l'écriture du nouveau jeton dans le stockage.
    storage.setRefreshToken.mockImplementationOnce(async () => {
      await authService.clearSession();
    });

    await expect(authService.refresh()).resolves.toBe(false);
    expect(storage.current()).toBeNull();
    expect(store.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('ne raccroche pas une nouvelle session à un refresh abandonné', async () => {
    const staleResponse = deferred<unknown>();
    const freshTokens = { accessToken: 'acces-b2', refreshToken: 'renouvellement-b2' };
    let refreshCalls = 0;
    const { client, storage, store, authService } = connected({
      '/auth/refresh': () => {
        refreshCalls += 1;
        return refreshCalls === 1 ? staleResponse.promise : Promise.resolve(freshTokens);
      },
      '/auth/logout': async () => undefined,
      '/auth/login': async () => ({
        user: USER,
        accessToken: 'acces-b1',
        refreshToken: 'renouvellement-b1',
      }),
    });

    const staleRefresh = authService.refresh();
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    await authService.logout();
    await authService.login({ email: 'ash@exemple.fr', password: 'pikachu25' });

    await expect(authService.refresh()).resolves.toBe(true);
    staleResponse.resolve(ROTATED_TOKENS);
    await expect(staleRefresh).resolves.toBe(false);

    expect(client.request).toHaveBeenCalledWith('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: 'renouvellement-b1' },
    });
    expect(storage.current()).toBe('renouvellement-b2');
    expect(store.getState()).toMatchObject({ status: 'authenticated', accessToken: 'acces-b2' });
  });

  it('efface le jeton d’une connexion fermée pendant l’écriture du stockage', async () => {
    const { storage, store, authService } = setup({
      '/auth/login': async () => ({ user: USER, ...ROTATED_TOKENS }),
    });
    storage.setRefreshToken.mockImplementationOnce(async () => {
      await authService.clearSession();
    });

    await expect(
      authService.login({ email: 'ash@exemple.fr', password: 'pikachu25' }),
    ).rejects.toBeInstanceOf(SessionClosedError);
    expect(storage.current()).toBeNull();
    expect(store.getState()).toMatchObject({ status: 'anonymous', accessToken: null });
  });

  it('ne signale pas l’échec d’une restauration fermée entre-temps', async () => {
    const profileResponse = deferred<unknown>();
    const { client, store, authService } = setup(
      {
        '/auth/refresh': async () => ROTATED_TOKENS,
        '/users/me': () => profileResponse.promise,
      },
      { storedToken: 'renouvellement-1' },
    );

    const restoration = authService.restoreSession();
    await vi.waitFor(() => expect(client.request).toHaveBeenCalledWith('/users/me'));
    await authService.clearSession();
    // Profil illisible : la lecture échoue, alors que la session a déjà été fermée.
    profileResponse.resolve(undefined);
    await restoration;

    expect(store.getState()).toMatchObject({ status: 'anonymous', restoreError: null });
  });

  it('garde la raison d’une déconnexion quand la session est vidée ensuite', async () => {
    const { store, authService } = connected({ '/auth/logout': async () => undefined });
    await authService.logout();

    await authService.clearSession();

    expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: 'logout' });
  });
});

describe('createAuthSession avec le client API', () => {
  /** Assemble client, store et service comme une application, sur un back simulé. */
  function assemble(backend: (path: string, authorization: string | undefined) => unknown) {
    const store = createAuthStore();
    const storage = createMemoryStorage('renouvellement-1');
    const fetch: FetchLike<null> = async (url, init) => {
      const outcome = backend(url, init?.headers?.Authorization);
      const status = typeof outcome === 'number' ? outcome : 200;
      return {
        ok: status >= 200 && status < 300,
        status,
        headers: { get: () => null },
        json: async () => (typeof outcome === 'number' ? { error: 'Unauthorized' } : outcome),
      };
    };
    const client = createApiClient({
      baseUrl: '/api/v1',
      fetch,
      createAbortController: () => ({ signal: null, abort: () => undefined }),
      session: createAuthSession(store, () => authService),
    });
    const authService = createAuthService({ client, storage, store });
    return { client, store, storage };
  }

  it('renouvelle la paire sur un 401 puis rejoue la requête avec le nouveau jeton', async () => {
    const { client, store, storage } = assemble((url, authorization) => {
      if (url.endsWith('/auth/refresh')) {
        return ROTATED_TOKENS;
      }
      return authorization === 'Bearer acces-2' ? { items: [] } : 401;
    });
    store.getState().startSession(USER, 'acces-1');

    await expect(client.request('/collections')).resolves.toEqual({ items: [] });
    expect(store.getState()).toMatchObject({ status: 'authenticated', accessToken: 'acces-2' });
    expect(storage.current()).toBe('renouvellement-2');
  });

  it('signale la session expirée quand le renouvellement est refusé', async () => {
    const { client, store, storage } = assemble(() => 401);
    store.getState().startSession(USER, 'acces-1');

    await expect(client.request('/collections')).rejects.toMatchObject({ status: 401 });
    await vi.waitFor(() => expect(storage.current()).toBeNull());
    expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: 'expired' });
  });
});
