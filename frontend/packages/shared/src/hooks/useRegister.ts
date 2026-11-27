import { useMutation } from '@tanstack/react-query';

import type { RegisterInput } from '../types';
import { useAuthService } from './authServiceContext';

/** Inscription. Le compte est créé sans ouvrir de session : le back ne renvoie pas de jetons. */
export function useRegister() {
  const authService = useAuthService();

  return useMutation({
    mutationFn: (input: RegisterInput) => authService.register(input),
  });
}
