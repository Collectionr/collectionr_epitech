import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import type { AuthStatus, SessionEndReason, User } from '../types';

// -- Types --------------------------------------------------------

/** État de la session, en mémoire uniquement : rien n'est persisté par ce store. */
export interface AuthState {
  /** `unknown` jusqu'à la fin de la restauration au démarrage */
  status: AuthStatus;
  /** Utilisateur connecté, `null` hors session */
  user: User | null;
  /** Jeton d'accès, jamais persisté */
  accessToken: string | null;
  /** Raison de la dernière fermeture de session, jusqu'à son acquittement ; `null` sinon */
  endReason: SessionEndReason | null;
  /** Erreur de la dernière restauration (serveur injoignable…), le statut restant `unknown` */
  restoreError: unknown;

  /** Ouvre la session après une connexion ou une restauration réussie. */
  startSession: (user: User, accessToken: string) => void;
  /** Remplace le jeton d'accès après un renouvellement, sans changer le statut. */
  setAccessToken: (accessToken: string) => void;
  /**
   * Ferme la session.
   * @param options - `reason` : expiration en cours d'usage ou déconnexion volontaire
   */
  endSession: (options?: { reason?: SessionEndReason }) => void;
  /** Efface la raison de fermeture, une fois prise en compte (message affiché, redirection faite). */
  acknowledgeEndReason: () => void;
  /** Signale l'échec de la restauration : la session reste indéterminée (`unknown`). */
  failRestore: (error: unknown) => void;
  /** Efface l'erreur de restauration avant un nouvel essai. */
  clearRestoreError: () => void;
}

/** Store de session, créé une fois par application. */
export type AuthStore = StoreApi<AuthState>;

// -- Store --------------------------------------------------------

/**
 * Crée le store de session. Une fabrique plutôt qu'un singleton : chaque application, et chaque
 * test, a son propre store.
 * @returns Le store, au statut `unknown`
 */
export function createAuthStore(): AuthStore {
  return createStore<AuthState>()((set) => ({
    status: 'unknown',
    user: null,
    accessToken: null,
    endReason: null,
    restoreError: null,

    startSession: (user, accessToken) =>
      set({ status: 'authenticated', user, accessToken, endReason: null, restoreError: null }),

    setAccessToken: (accessToken) => set({ accessToken }),

    endSession: ({ reason } = {}) =>
      set({
        status: 'anonymous',
        user: null,
        accessToken: null,
        endReason: reason ?? null,
        restoreError: null,
      }),

    acknowledgeEndReason: () => set({ endReason: null }),

    failRestore: (error) => set({ status: 'unknown', restoreError: error }),

    clearRestoreError: () => set({ restoreError: null }),
  }));
}

// -- Selectors ----------------------------------------------------

/** Vrai si la session est ouverte. */
export const selectIsAuthenticated = (state: AuthState) => state.status === 'authenticated';
