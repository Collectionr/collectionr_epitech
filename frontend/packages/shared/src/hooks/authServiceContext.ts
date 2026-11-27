import { createContext, useContext } from 'react';

import type { AuthService } from '../services/authService';

/** Service d'authentification de l'application, fourni une fois à sa racine. */
export const AuthServiceContext = createContext<AuthService | null>(null);

/**
 * Lit le service d'authentification fourni à la racine de l'application.
 * @throws {Error} Si aucun service n'est fourni
 */
export function useAuthService(): AuthService {
  const authService = useContext(AuthServiceContext);
  if (authService === null) {
    throw new Error(
      "AuthServiceContext absent : fournir le service d'authentification à la racine de l'application",
    );
  }
  return authService;
}
