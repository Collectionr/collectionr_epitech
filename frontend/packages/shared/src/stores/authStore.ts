import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import type { AuthStatus, User } from '../types';

// -- Types --------------------------------------------------------

/** État de la session, en mémoire uniquement : rien n'est persisté par ce store. */
export interface AuthState {
  /** `unknown` jusqu'à la fin de la restauration au démarrage */
  status: AuthStatus;
  /** Utilisateur connecté, `null` hors session */
  user: User | null;
  /** Jeton d'accès, jamais persisté */
  accessToken: string | null;
  /** Vrai quand la session vient d'expirer en cours d'usage, jusqu'à l'affichage du message */
  sessionExpired: boolean;

  /** Ouvre la session après une connexion ou une restauration réussie. */
  startSession: (user: User, accessToken: string) => void;
  /** Remplace le jeton d'accès après un renouvellement, sans changer le statut. */
  setAccessToken: (accessToken: string) => void;
  /**
   * Ferme la session.
   * @param options - `expired` : la session a expiré en cours d'usage, à signaler à l'utilisateur
   */
  endSession: (options?: { expired?: boolean }) => void;
  /** Efface l'indicateur d'expiration, une fois le message affiché. */
  acknowledgeExpiry: () => void;
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
    sessionExpired: false,

    startSession: (user, accessToken) =>
      set({ status: 'authenticated', user, accessToken, sessionExpired: false }),

    setAccessToken: (accessToken) => set({ accessToken }),

    endSession: ({ expired = false } = {}) =>
      set({ status: 'anonymous', user: null, accessToken: null, sessionExpired: expired }),

    acknowledgeExpiry: () => set({ sessionExpired: false }),
  }));
}

// -- Selectors ----------------------------------------------------

/** Vrai si la session est ouverte. */
export const selectIsAuthenticated = (state: AuthState) => state.status === 'authenticated';
