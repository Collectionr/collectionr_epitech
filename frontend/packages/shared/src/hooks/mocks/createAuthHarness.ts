import { createElement } from 'react';
import type { ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

import { createAuthService } from '../../services/authService';
import type { TokenStorage } from '../../services/authService';
import type { ApiClient, ApiPath, ApiRequestOptions } from '../../services/apiClient';
import { createQueryClient } from '../../services/queryClient';
import { createAuthStore } from '../../stores';
import type { User } from '../../types';
import { AuthServiceContext } from '../authServiceContext';

/** Utilisateur de test. */
export const TEST_USER: User = {
  id: '0b6c3f1e-6d5a-4c1b-9a8e-2f4d7c9b1a00',
  email: 'ash@exemple.fr',
  username: 'ash',
  createdAt: '2026-09-27T12:00:00.000Z',
};

type Handler = (options: ApiRequestOptions | undefined) => Promise<unknown>;

/**
 * Doublure de l'environnement des hooks d'authentification : vrai service, vrai store et cache
 * configuré comme l'application, sur un client API factice et un stockage en mémoire.
 * @param handlers - Réponse de chaque chemin ; un chemin absent fait échouer l'appel
 * @param storedToken - Jeton de renouvellement présent au départ
 */
export function createAuthHarness(
  handlers: Partial<Record<ApiPath, Handler>> = {},
  storedToken: string | null = null,
) {
  let token = storedToken;
  const storage = {
    current: () => token,
    getRefreshToken: async () => token,
    setRefreshToken: async (refreshToken: string) => {
      token = refreshToken;
    },
    clearRefreshToken: async () => {
      token = null;
    },
  } satisfies TokenStorage & { current: () => string | null };
  const client = {
    request: vi.fn((path: ApiPath, options?: ApiRequestOptions) => {
      const handler = handlers[path];
      return handler ? handler(options) : Promise.reject(new Error(`Appel inattendu : ${path}`));
    }),
  } satisfies ApiClient;
  const store = createAuthStore();
  const authService = createAuthService({ client, storage, store });
  const queryClient = createQueryClient();

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, {
      client: queryClient,
      children: createElement(AuthServiceContext.Provider, { value: authService, children }),
    });
  }

  return { client, storage, store, authService, queryClient, wrapper };
}
