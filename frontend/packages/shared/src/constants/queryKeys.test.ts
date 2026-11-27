import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { QUERY_KEYS } from './queryKeys';

/** Clés des requêtes en cache que toucherait une invalidation de `filterKey`. */
function keysMatchedBy(filterKey: readonly unknown[]): unknown[] {
  const client = new QueryClient();
  const cachedKeys = [
    QUERY_KEYS.me,
    QUERY_KEYS.collections,
    QUERY_KEYS.collection('c1'),
    QUERY_KEYS.cards('c1', { page: 2 }),
    QUERY_KEYS.collection('c2'),
    QUERY_KEYS.cards('c2'),
    QUERY_KEYS.catalog('dracaufeu'),
  ];
  for (const key of cachedKeys) {
    client.setQueryData(key, 'donnée');
  }
  return client
    .getQueryCache()
    .findAll({ queryKey: filterKey })
    .map((query) => query.queryKey);
}

describe('QUERY_KEYS', () => {
  it('donne une clé distincte à chaque ressource', () => {
    expect(QUERY_KEYS.me).toEqual(['me']);
    expect(QUERY_KEYS.collections).toEqual(['collections']);
    expect(QUERY_KEYS.collection('c1')).toEqual(['collections', 'c1']);
    expect(QUERY_KEYS.cards('c1', { rarity: 'Rare' })).toEqual([
      'collections',
      'c1',
      'cards',
      { rarity: 'Rare' },
    ]);
    expect(QUERY_KEYS.catalog('dracaufeu')).toEqual(['catalog', 'dracaufeu']);
  });

  it('utilise des filtres vides par défaut pour les cartes', () => {
    expect(QUERY_KEYS.cards('c1')).toEqual(['collections', 'c1', 'cards', {}]);
  });

  it('touche les collections, leurs détails et leurs cartes depuis la clé des collections', () => {
    expect(keysMatchedBy(QUERY_KEYS.collections)).toEqual([
      QUERY_KEYS.collections,
      QUERY_KEYS.collection('c1'),
      QUERY_KEYS.cards('c1', { page: 2 }),
      QUERY_KEYS.collection('c2'),
      QUERY_KEYS.cards('c2'),
    ]);
  });

  it("ne touche qu'une collection et ses cartes depuis la clé de cette collection", () => {
    expect(keysMatchedBy(QUERY_KEYS.collection('c1'))).toEqual([
      QUERY_KEYS.collection('c1'),
      QUERY_KEYS.cards('c1', { page: 2 }),
    ]);
  });
});
