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
 * voir data-et-etat.md). Si le stockage est indisponible ou plein, la session reste utilisable
 * mais n'est pas restaurée au prochain chargement : la connexion est simplement redemandée.
 * @param storage - Stockage à utiliser, `localStorage` par défaut
 */
export function createWebTokenStorage(
  storage: BrowserStorage | null = readLocalStorage(),
): TokenStorage {
  return {
    async getRefreshToken() {
      try {
        return storage?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? null;
      } catch {
        return null;
      }
    },
    async setRefreshToken(refreshToken) {
      try {
        storage?.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
      } catch {
        // Stockage plein ou bloqué : le jeton reste valable pour cette visite seulement.
      }
    },
    async clearRefreshToken() {
      try {
        storage?.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      } catch {
        // Stockage bloqué : il ne contient alors aucun jeton à supprimer.
      }
    },
  };
}
