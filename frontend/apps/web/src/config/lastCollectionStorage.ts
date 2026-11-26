/** Préfixe de la clé, suivi de l'identifiant de l'utilisateur : une valeur par compte. */
export const LAST_COLLECTION_STORAGE_KEY_PREFIX = 'collectionr.lastCollection.';

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Dernière collection où l'utilisateur a ajouté une carte (`localStorage`) : l'API ne le fournit
 * pas. Simple préférence d'affichage : illisible ou absente, la page présélectionne une autre
 * collection.
 * @param userId - Utilisateur connecté
 * @returns L'identifiant enregistré, ou `null`
 */
export function readLastCollection(userId: string): string | null {
  try {
    return storage()?.getItem(`${LAST_COLLECTION_STORAGE_KEY_PREFIX}${userId}`) ?? null;
  } catch {
    return null;
  }
}

/**
 * Enregistre la collection du dernier ajout. Un échec (stockage plein ou bloqué) est ignoré : la
 * présélection n'est qu'une commodité.
 * @param userId - Utilisateur connecté
 * @param collectionId - Collection du dernier ajout
 */
export function writeLastCollection(userId: string, collectionId: string): void {
  try {
    storage()?.setItem(`${LAST_COLLECTION_STORAGE_KEY_PREFIX}${userId}`, collectionId);
  } catch {
    // Préférence perdue : la page présélectionnera une autre collection.
  }
}
