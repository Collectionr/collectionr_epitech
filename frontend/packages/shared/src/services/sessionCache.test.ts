import { describe, expect, it } from 'vitest';

import { QUERY_KEYS } from '../constants/queryKeys';
import { createAuthStore } from '../stores';
import type { SessionEndReason, User } from '../types';
import { createQueryClient } from './queryClient';
import { clearCacheOnSessionEnd } from './sessionCache';

const USER: User = {
  id: '0b6c3f1e-6d5a-4c1b-9a8e-2f4d7c9b1a00',
  email: 'ash@exemple.fr',
  username: 'ash',
  createdAt: '2026-09-27T12:00:00.000Z',
};

/** Session ouverte, cache rempli et surveillance branchée. */
function setUp() {
  const store = createAuthStore();
  const queryClient = createQueryClient();
  const stop = clearCacheOnSessionEnd(store, queryClient);
  store.getState().startSession(USER, 'acces-1');
  queryClient.setQueryData(QUERY_KEYS.me, USER);
  queryClient.setQueryData(QUERY_KEYS.collections, ['Base']);
  return { store, queryClient, stop };
}

describe('clearCacheOnSessionEnd', () => {
  it.each<[string, SessionEndReason | undefined]>([
    ['une expiration', 'expired'],
    ['une déconnexion', 'logout'],
    ['une fermeture sans raison', undefined],
  ])('vide le cache après %s', (_label, reason) => {
    const { store, queryClient } = setUp();

    store.getState().endSession({ reason });

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('garde le cache tant que la session reste ouverte, renouvellement du jeton compris', () => {
    const { store, queryClient } = setUp();

    store.getState().setAccessToken('acces-2');

    expect(queryClient.getQueryData(QUERY_KEYS.collections)).toEqual(['Base']);
  });

  it('ne vide pas le cache à l’ouverture de la session', () => {
    const store = createAuthStore();
    const queryClient = createQueryClient();
    clearCacheOnSessionEnd(store, queryClient);
    store.getState().endSession();
    queryClient.setQueryData(QUERY_KEYS.me, USER);

    store.getState().startSession(USER, 'acces-1');

    expect(queryClient.getQueryData(QUERY_KEYS.me)).toEqual(USER);
  });

  it('ne vide plus rien une fois arrêtée', () => {
    const { store, queryClient, stop } = setUp();

    stop();
    store.getState().endSession({ reason: 'expired' });

    expect(queryClient.getQueryData(QUERY_KEYS.collections)).toEqual(['Base']);
  });
});
