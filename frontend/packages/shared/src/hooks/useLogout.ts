import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useAuthService } from './authServiceContext';

/**
 * Déconnexion : révocation du jeton auprès du back, fermeture de la session, puis cache vidé,
 * même si l'appel au back échoue. La redirection revient à l'application.
 */
export function useLogout() {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      queryClient.clear();
    },
  });
}
