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
  it('démarre au statut unknown, sans utilisateur, jeton, raison ni erreur', () => {
    const state = createAuthStore().getState();

    expect(state).toMatchObject({
      status: 'unknown',
      user: null,
      accessToken: null,
      endReason: null,
      restoreError: null,
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

  it('ferme la session sans raison par défaut', () => {
    const store = createAuthStore();
    store.getState().startSession(USER, 'jeton-acces');

    store.getState().endSession();

    expect(store.getState()).toMatchObject({
      status: 'anonymous',
      user: null,
      accessToken: null,
      endReason: null,
    });
  });

  it.each(['expired', 'logout'] as const)(
    'garde la raison « %s » jusqu’à son acquittement',
    (reason) => {
      const store = createAuthStore();
      store.getState().startSession(USER, 'jeton-acces');

      store.getState().endSession({ reason });
      expect(store.getState()).toMatchObject({ status: 'anonymous', endReason: reason });

      store.getState().acknowledgeEndReason();
      expect(store.getState().endReason).toBeNull();
    },
  );

  it('efface la raison de fermeture à la connexion suivante', () => {
    const store = createAuthStore();
    store.getState().endSession({ reason: 'expired' });

    store.getState().startSession(USER, 'jeton-acces');

    expect(store.getState().endReason).toBeNull();
  });

  it('garde la session indéterminée quand la restauration échoue', () => {
    const store = createAuthStore();
    const error = new Error('Serveur injoignable');

    store.getState().failRestore(error);
    expect(store.getState()).toMatchObject({ status: 'unknown', restoreError: error });

    store.getState().clearRestoreError();
    expect(store.getState()).toMatchObject({ status: 'unknown', restoreError: null });
  });

  it('efface l’erreur de restauration quand la session est tranchée', () => {
    const store = createAuthStore();
    store.getState().failRestore(new Error('Serveur injoignable'));
    store.getState().startSession(USER, 'jeton-acces');
    expect(store.getState().restoreError).toBeNull();

    store.getState().failRestore(new Error('Serveur injoignable'));
    store.getState().endSession();
    expect(store.getState().restoreError).toBeNull();
  });

  it('crée un store indépendant à chaque appel', () => {
    const first = createAuthStore();
    const second = createAuthStore();

    first.getState().startSession(USER, 'jeton-acces');

    expect(second.getState().status).toBe('unknown');
  });
});
