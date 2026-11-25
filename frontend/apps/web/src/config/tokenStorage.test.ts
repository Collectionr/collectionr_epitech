import { afterEach, describe, expect, it } from 'vitest';

import { createWebTokenStorage, REFRESH_TOKEN_STORAGE_KEY } from './tokenStorage';
import type { BrowserStorage } from './tokenStorage';

const blockedStorage: BrowserStorage = {
  getItem: () => {
    throw new DOMException('Stockage bloqué', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('Quota dépassé', 'QuotaExceededError');
  },
  removeItem: () => {
    throw new DOMException('Stockage bloqué', 'SecurityError');
  },
};

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

  it('reste utilisable quand le stockage lève une exception', async () => {
    const storage = createWebTokenStorage(blockedStorage);

    await expect(storage.setRefreshToken('renouvellement-1')).resolves.toBeUndefined();
    await expect(storage.getRefreshToken()).resolves.toBeNull();
    await expect(storage.clearRefreshToken()).resolves.toBeUndefined();
  });

  it('reste utilisable sans stockage', async () => {
    const storage = createWebTokenStorage(null);

    await storage.setRefreshToken('renouvellement-1');
    await expect(storage.getRefreshToken()).resolves.toBeNull();
    await expect(storage.clearRefreshToken()).resolves.toBeUndefined();
  });
});
