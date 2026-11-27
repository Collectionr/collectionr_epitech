import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthService } from '@shared/services';
import type { ApiClient, ApiPath, ApiRequestOptions } from '@shared/services';
import { createAuthStore } from '@shared/stores';

import { createWebTokenStorage, REFRESH_TOKEN_STORAGE_KEY } from './tokenStorage';
import type { BrowserStorage } from './tokenStorage';

function storageError(name: string): DOMException {
  return new DOMException('Stockage indisponible', name);
}

/**
 * Doublure de `localStorage` : chaque opération fonctionne sur une table en mémoire, sauf celles
 * listées dans `failing`, qui lèvent une exception.
 */
function createFakeStorage(
  initial: Record<string, string>,
  failing: ReadonlyArray<'getItem' | 'setItem' | 'removeItem'> = [],
) {
  const values = new Map(Object.entries(initial));
  const storage = {
    values,
    getItem: vi.fn((key: string) => {
      if (failing.includes('getItem')) {
        throw storageError('SecurityError');
      }
      return values.get(key) ?? null;
    }),
    setItem: vi.fn((key: string, value: string) => {
      if (failing.includes('setItem')) {
        throw storageError('QuotaExceededError');
      }
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      if (failing.includes('removeItem')) {
        throw storageError('SecurityError');
      }
      values.delete(key);
    }),
  } satisfies BrowserStorage & { values: Map<string, string> };
  return storage;
}

describe('createWebTokenStorage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('enregistre, relit puis supprime le jeton dans localStorage par défaut', async () => {
    const storage = createWebTokenStorage();

    await storage.setRefreshToken('renouvellement-1');
    expect(window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)).toBe('renouvellement-1');
    await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-1');

    await storage.clearRefreshToken();
    await expect(storage.getRefreshToken()).resolves.toBeNull();
  });

  it('renvoie null quand aucun jeton n’est enregistré', async () => {
    await expect(createWebTokenStorage().getRefreshToken()).resolves.toBeNull();
  });

  it('relit la valeur persistée tant qu’elle fait foi (renouvellement d’un autre onglet)', async () => {
    const browserStorage = createFakeStorage({});
    const storage = createWebTokenStorage(browserStorage);
    await storage.setRefreshToken('renouvellement-1');

    browserStorage.values.set(REFRESH_TOKEN_STORAGE_KEY, 'renouvellement-autre-onglet');

    await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-autre-onglet');
  });

  describe('quand seule l’écriture échoue', () => {
    it('garde le nouveau jeton en mémoire et ne relit plus l’ancien, supprimé', async () => {
      const browserStorage = createFakeStorage(
        { [REFRESH_TOKEN_STORAGE_KEY]: 'renouvellement-1' },
        ['setItem'],
      );
      const storage = createWebTokenStorage(browserStorage);
      await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-1');

      await storage.setRefreshToken('renouvellement-2');

      await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-2');
      expect(browserStorage.values.has(REFRESH_TOKEN_STORAGE_KEY)).toBe(false);
      expect(browserStorage.getItem).toHaveBeenCalledTimes(1);
    });

    it('ne relit jamais l’ancien jeton, même s’il n’a pas pu être supprimé', async () => {
      const browserStorage = createFakeStorage(
        { [REFRESH_TOKEN_STORAGE_KEY]: 'renouvellement-1' },
        ['setItem', 'removeItem'],
      );
      const storage = createWebTokenStorage(browserStorage);

      await storage.setRefreshToken('renouvellement-2');
      await storage.setRefreshToken('renouvellement-3');

      await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-3');
      expect(browserStorage.values.get(REFRESH_TOKEN_STORAGE_KEY)).toBe('renouvellement-1');
      expect(browserStorage.getItem).not.toHaveBeenCalled();

      await storage.clearRefreshToken();
      await expect(storage.getRefreshToken()).resolves.toBeNull();
    });

    it('fait présenter le nouveau jeton au refresh suivant, jamais l’ancien', async () => {
      const browserStorage = createFakeStorage(
        { [REFRESH_TOKEN_STORAGE_KEY]: 'renouvellement-1' },
        ['setItem'],
      );
      let rotation = 1;
      const request = vi.fn(async (path: ApiPath, options?: ApiRequestOptions) => {
        if (path !== '/auth/refresh') {
          throw new Error(`Appel inattendu : ${path} ${JSON.stringify(options)}`);
        }
        rotation += 1;
        return { accessToken: `acces-${rotation}`, refreshToken: `renouvellement-${rotation}` };
      });
      const client: ApiClient = { request };
      const authService = createAuthService({
        client,
        storage: createWebTokenStorage(browserStorage),
        store: createAuthStore(),
      });

      await expect(authService.refresh()).resolves.toBe(true);
      await expect(authService.refresh()).resolves.toBe(true);

      expect(request.mock.calls.map(([, options]) => options?.body)).toEqual([
        { refreshToken: 'renouvellement-1' },
        { refreshToken: 'renouvellement-2' },
      ]);
    });
  });

  it('se rabat sur le dernier jeton connu quand seule la lecture échoue', async () => {
    const storage = createWebTokenStorage(createFakeStorage({}, ['getItem']));

    await storage.setRefreshToken('renouvellement-1');

    await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-1');
  });

  it('garde le jeton en mémoire quand toutes les opérations échouent', async () => {
    const storage = createWebTokenStorage(
      createFakeStorage({}, ['getItem', 'setItem', 'removeItem']),
    );

    await expect(storage.setRefreshToken('renouvellement-1')).resolves.toBeUndefined();
    await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-1');
    await expect(storage.clearRefreshToken()).resolves.toBeUndefined();
    await expect(storage.getRefreshToken()).resolves.toBeNull();
  });

  it('garde le jeton en mémoire pour la visite sans localStorage', async () => {
    const storage = createWebTokenStorage(null);
    await expect(storage.getRefreshToken()).resolves.toBeNull();

    await storage.setRefreshToken('renouvellement-1');
    await expect(storage.getRefreshToken()).resolves.toBe('renouvellement-1');

    await storage.clearRefreshToken();
    await expect(storage.getRefreshToken()).resolves.toBeNull();
  });
});
