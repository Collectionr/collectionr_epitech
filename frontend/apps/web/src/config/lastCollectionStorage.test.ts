import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  LAST_COLLECTION_STORAGE_KEY_PREFIX,
  readLastCollection,
  writeLastCollection,
} from './lastCollectionStorage';

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('dernière collection utilisée', () => {
  it('garde une collection par utilisateur', () => {
    writeLastCollection('ash', 'c1');
    writeLastCollection('ondine', 'c2');

    expect(readLastCollection('ash')).toBe('c1');
    expect(readLastCollection('ondine')).toBe('c2');
    expect(window.localStorage.getItem(`${LAST_COLLECTION_STORAGE_KEY_PREFIX}ash`)).toBe('c1');
  });

  it('ne renvoie rien sans valeur enregistrée', () => {
    expect(readLastCollection('ash')).toBeNull();
  });

  it('ignore un stockage qui refuse la lecture ou l’écriture', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Stockage bloqué');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Stockage plein');
    });

    expect(() => writeLastCollection('ash', 'c1')).not.toThrow();
    expect(readLastCollection('ash')).toBeNull();
  });

  it('ignore un localStorage inaccessible', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('Accès refusé');
    });

    expect(() => writeLastCollection('ash', 'c1')).not.toThrow();
    expect(readLastCollection('ash')).toBeNull();
  });
});
