import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '../constants/queryKeys';
import type { LoginCredentials } from '../types';
import { useAuthService } from './authServiceContext';

/**
 * Connexion. En cas de succès, la session est ouverte et le profil est mis en cache ; la
 * redirection revient à l'application (routeur web ou navigation mobile).
 */
export function useLogin() {
  const authService = useAuthService();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginCredentials) => authService.login(credentials),
    onSuccess: (user) => {
      queryClient.setQueryData(QUERY_KEYS.me, user);
    },
  });
}
