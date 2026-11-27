import type { QueryClient } from '@tanstack/react-query';

import type { AuthStore } from '../stores';

/**
 * Vide le cache des appels API dès que la session quitte `authenticated`, quelle qu'en soit la
 * raison : déconnexion, expiration, renouvellement refusé. Sans cela, les données d'un compte
 * resteraient en mémoire, et affichées, pour le compte connecté ensuite sans recharger la page.
 * À brancher une seule fois par application, là où le cache est créé.
 * @param store - Store de session
 * @param queryClient - Cache des appels API de l'application
 * @returns La fonction qui arrête la surveillance
 */
export function clearCacheOnSessionEnd(store: AuthStore, queryClient: QueryClient): () => void {
  return store.subscribe((state, previous) => {
    if (previous.status === 'authenticated' && state.status !== 'authenticated') {
      queryClient.clear();
    }
  });
}
