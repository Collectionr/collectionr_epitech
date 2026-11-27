import { QueryClient } from '@tanstack/react-query';

import { ApiError, NetworkError } from './apiClient';

/** Durée pendant laquelle une donnée est servie depuis le cache sans être redemandée (5 min). */
export const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000;
/** Durée de conservation en cache d'une donnée qui n'est plus affichée (30 min). */
export const DEFAULT_GC_TIME_MS = 30 * 60 * 1000;
/** Nombre maximal de relances d'une requête après un échec temporaire. */
export const MAX_QUERY_RETRIES = 2;

const HTTP_SERVER_ERROR_MIN = 500;

/**
 * Indique si une requête en échec peut être relancée : erreur réseau ou 5xx, au plus
 * `MAX_QUERY_RETRIES` fois. Une 4xx ne change pas en relançant ; toute autre erreur est un bug.
 * @param failureCount - Nombre d'échecs déjà subis par la requête
 * @param error - Dernière erreur levée
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_QUERY_RETRIES) {
    return false;
  }
  if (error instanceof NetworkError) {
    return true;
  }
  return error instanceof ApiError && error.status >= HTTP_SERVER_ERROR_MIN;
}

/**
 * Crée le cache des appels API, configuré une seule fois pour toute l'application. Les mutations
 * ne sont jamais relancées automatiquement : une connexion ou un ajout rejoué en double n'est pas
 * sans effet (tentative comptée par la limite de débit, doublon).
 *
 * Requêtes et mutations partent même quand le navigateur se dit hors ligne (`networkMode:
 * 'always'`) : l'appel échoue aussitôt et l'erreur réseau s'affiche. Sinon TanStack Query les met
 * en pause, sans message, puis les envoie seules au retour du réseau (une connexion partirait
 * longtemps après le clic).
 * @returns Le `QueryClient` à fournir à `QueryClientProvider`
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        gcTime: DEFAULT_GC_TIME_MS,
        retry: shouldRetryQuery,
        refetchOnWindowFocus: false,
        networkMode: 'always',
      },
      mutations: {
        retry: false,
        networkMode: 'always',
      },
    },
  });
}
