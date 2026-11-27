import { useMutation } from '@tanstack/react-query';

import { useAuthService } from './authServiceContext';

/**
 * Déconnexion : fermeture de la session, puis révocation du jeton auprès du back, même si cet appel
 * échoue. La fin de session vide le cache (`clearCacheOnSessionEnd`, branché par l'application),
 * sans attendre la réponse du back. La redirection revient à l'application.
 */
export function useLogout() {
  const authService = useAuthService();

  return useMutation({
    mutationFn: () => authService.logout(),
  });
}
