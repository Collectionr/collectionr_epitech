/**
 * Recherche dans le catalogue (autocomplétion, COLLR-702). Longueurs et nombre de résultats : bornes
 * du back (`CardNameSearch.ts` du module catalogue) ; temporisation : réglage de l'autocomplétion.
 */
export const CATALOG_SEARCH = {
  /** Caractères avant de lancer une recherche */
  minLength: 2,
  /** Caractères au plus : au-delà, le back refuse la recherche */
  maxLength: 100,
  /** Résultats demandés (valeur par défaut du back, 50 au plus) */
  limit: 20,
  /** Attente après la dernière frappe avant de chercher, en millisecondes */
  debounceMs: 200,
} as const;
