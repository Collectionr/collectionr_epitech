import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { AuthStatus, SessionEndReason, User } from '../types';
import { useAuthService } from './authServiceContext';

/** État de la session exposé aux composants. */
export interface AuthSessionState {
  /** `unknown` jusqu'à ce que la restauration au démarrage aboutisse */
  status: AuthStatus;
  /** Utilisateur connecté, `null` hors session */
  user: User | null;
  /** Raison de la dernière fermeture de session (expiration, déconnexion), `null` sinon */
  endReason: SessionEndReason | null;
  /** Erreur de la dernière restauration, `null` sinon ; le statut reste alors `unknown` */
  restoreError: unknown;
}

/** État de la session, mis à jour à chaque connexion, renouvellement refusé ou déconnexion. */
export function useAuth(): AuthSessionState {
  const { store } = useAuthService();
  return useStore(
    store,
    useShallow((state) => ({
      status: state.status,
      user: state.user,
      endReason: state.endReason,
      restoreError: state.restoreError,
    })),
  );
}
