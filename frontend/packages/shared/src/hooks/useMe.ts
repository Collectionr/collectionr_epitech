import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '../constants/queryKeys';
import { useAuthService } from './authServiceContext';
import { useAuth } from './useAuth';

/**
 * Profil de l'utilisateur connecté (`GET /users/me`), actif seulement en session. Il démarre sur
 * l'utilisateur de la session, déjà lu à la connexion ou à la restauration, sans nouvel appel.
 */
export function useMe() {
  const authService = useAuthService();
  const { status } = useAuth();

  return useQuery({
    queryKey: QUERY_KEYS.me,
    queryFn: () => authService.me(),
    enabled: status === 'authenticated',
    initialData: () => authService.store.getState().user ?? undefined,
  });
}
