import { describe, expect, it } from 'vitest';

import type { User } from '../types';
import { createAuthStore, selectIsAuthenticated } from './authStore';

const USER: User = {
  id: '0b6c3f1e-6d5a-4c1b-9a8e-2f4d7c9b1a00',
  email: 'ash@exemple.fr',
  username: 'ash',
  createdAt: '2026-09-27T12:00:00.000Z',
};

describe('createAuthStore', () => {
  it('démarre au statut unknown, sans utilisateur ni jeton', () => {
    const state = createAuthStore().getState();

    expect(state).toMatchObject({
      status: 'unknown',
      user: null,
      accessToken: null,
      sessionExpired: false,
    });
    expect(selectIsAuthenticated(state)).toBe(false);
  });

  it('ouvre la session avec l’utilisateur et le jeton d’accès', () => {
    const store = createAuthStore();

    store.getState().startSession(USER, 'jeton-acces');

    expect(store.getState()).toMatchObject({
      status: 'authenticated',
      user: USER,
      accessToken: 'jeton-acces',
    });
    expect(selectIsAuthenticated(store.getState())).toBe(true);
  });

  it('remplace le jeton d’accès sans changer le statut', () => {
    const store = createAuthStore();

    store.getState().setAccessToken('jeton-renouvele');

    expect(store.getState()).toMatchObject({ status: 'unknown', accessToken: 'jeton-renouvele' });
  });

  it('ferme la session sans la signaler comme expirée par défaut', () => {
    const store = createAuthStore();
    store.getState().startSession(USER, 'jeton-acces');

    store.getState().endSession();

    expect(store.getState()).toMatchObject({
      status: 'anonymous',
      user: null,
      accessToken: null,
      sessionExpired: false,
    });
  });

  it('signale une session expirée jusqu’à ce que le message soit acquitté', () => {
    const store = createAuthStore();
    store.getState().startSession(USER, 'jeton-acces');

    store.getState().endSession({ expired: true });
    expect(store.getState()).toMatchObject({ status: 'anonymous', sessionExpired: true });

    store.getState().acknowledgeExpiry();
    expect(store.getState().sessionExpired).toBe(false);
  });

  it('efface l’indicateur d’expiration à la connexion suivante', () => {
    const store = createAuthStore();
    store.getState().endSession({ expired: true });

    store.getState().startSession(USER, 'jeton-acces');

    expect(store.getState().sessionExpired).toBe(false);
  });

  it('crée un store indépendant à chaque appel', () => {
    const first = createAuthStore();
    const second = createAuthStore();

    first.getState().startSession(USER, 'jeton-acces');

    expect(second.getState().status).toBe('unknown');
  });
});
