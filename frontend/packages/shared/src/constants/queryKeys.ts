/** Filtres d'une liste de cartes, inclus dans sa clé de cache (l'ordre des champs est sans effet). */
export type CardFilters = Readonly<Record<string, string | number | boolean | null | undefined>>;

/**
 * Clés de cache TanStack Query, centralisées ici : aucune clé n'est écrite à la main dans un hook.
 * Elles sont hiérarchiques : invalider `collections` invalide aussi chaque collection et ses cartes,
 * invalider `collection(id)` invalide aussi ses cartes.
 */
export const QUERY_KEYS = {
  /** Profil de l'utilisateur connecté (`GET /users/me`) */
  me: ['me'] as const,
  /** Liste des collections de l'utilisateur */
  collections: ['collections'] as const,
  /** Détail d'une collection */
  collection: (collectionId: string) => ['collections', collectionId] as const,
  /** Cartes d'une collection, selon les filtres actifs */
  cards: (collectionId: string, filters: CardFilters = {}) =>
    ['collections', collectionId, 'cards', filters] as const,
  /** Recherche dans le catalogue (autocomplétion) */
  catalog: (query: string) => ['catalog', query] as const,
} as const;
