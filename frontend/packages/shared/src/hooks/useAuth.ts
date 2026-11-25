import { useStore } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

import type { AuthStatus, User } from '../types';
import { useAuthService } from './authServiceContext';

/** État de la session exposé aux composants. */
export interface AuthSessionState {
  /** `unknown` jusqu'à la fin de la restauration au démarrage */
  status: AuthStatus;
  /** Utilisateur connecté, `null` hors session */
  user: User | null;
  /** Vrai quand la session vient d'expirer en cours d'usage */
  sessionExpired: boolean;
  /** Efface l'indicateur d'expiration, une fois le message affiché */
  acknowledgeSessionExpiry: () => void;
}

/** État de la session, mis à jour à chaque connexion, renouvellement refusé ou déconnexion. */
export function useAuth(): AuthSessionState {
  const { store } = useAuthService();
  return useStore(
    store,
    useShallow((state) => ({
      status: state.status,
      user: state.user,
      sessionExpired: state.sessionExpired,
      acknowledgeSessionExpiry: state.acknowledgeExpiry,
    })),
  );
}
