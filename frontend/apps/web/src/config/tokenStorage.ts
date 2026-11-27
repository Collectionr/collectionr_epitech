import type { TokenStorage } from '@shared/services';

/** Clé du jeton de renouvellement dans `localStorage`. */
export const REFRESH_TOKEN_STORAGE_KEY = 'collectionr.refreshToken';

/** Sous-ensemble de `Storage` utilisé, pour pouvoir fournir une doublure en test. */
export type BrowserStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * `localStorage`, ou `null` s'il est inaccessible : son simple accès lève une exception quand le
 * navigateur bloque le stockage (cookies tiers refusés, certaines navigations privées).
 */
function readLocalStorage(): BrowserStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Stockage du jeton de renouvellement dans `localStorage` (décision PO du 25/11/2026 pour l'Alpha,
 * voir data-et-etat.md). La valeur persistée fait foi tant qu'elle peut être écrite : elle reflète
 * aussi les renouvellements faits par les autres onglets.
 *
 * Si une écriture échoue (stockage plein ou bloqué), ou si `localStorage` est inaccessible, le
 * jeton est gardé en mémoire et fait foi pour cet onglet jusqu'à la fin de la visite : la valeur
 * persistée, désormais périmée, est supprimée si possible et n'est plus jamais relue. Présenter un
 * jeton déjà utilisé ferait révoquer toute la chaîne de connexion par le back. La session dure alors
 * le temps de la visite, et la connexion est redemandée au prochain chargement.
 * @param storage - Stockage à utiliser, `localStorage` par défaut
 */
export function createWebTokenStorage(
  storage: BrowserStorage | null = readLocalStorage(),
): TokenStorage {
  let memoryToken: string | null = null;
  let persistedIsAuthoritative = storage !== null;

  function removePersistedToken() {
    try {
      storage?.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    } catch {
      // Suppression impossible : la valeur restante n'est de toute façon plus relue par cet onglet.
    }
  }

  return {
    async getRefreshToken() {
      if (!persistedIsAuthoritative) {
        return memoryToken;
      }
      try {
        return storage?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? null;
      } catch {
        // Lecture impossible : le dernier jeton connu de cet onglet reste le plus sûr.
        return memoryToken;
      }
    },

    async setRefreshToken(refreshToken) {
      memoryToken = refreshToken;
      if (!persistedIsAuthoritative) {
        return;
      }
      try {
        storage?.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
      } catch {
        persistedIsAuthoritative = false;
        removePersistedToken();
      }
    },

    async clearRefreshToken() {
      memoryToken = null;
      removePersistedToken();
    },
  };
}
