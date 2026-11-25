/**
 * Chemins de l'application web, déclarés ici uniquement : aucun composant n'écrit d'URL en dur.
 * Les chemins à paramètre se construisent avec les fonctions ci-dessous.
 */
export const ROUTES = {
  /** Connexion (publique) */
  login: '/connexion',
  /** Inscription (publique) */
  signup: '/inscription',
  /** Réinitialisation du mot de passe (publique, page provisoire) */
  forgotPassword: '/mot-de-passe-oublie',
  /** Dashboard, page d'accueil connectée */
  dashboard: '/',
  /** Liste des collections */
  collections: '/collections',
  /** Détail d'une collection, motif du routeur ; utiliser `collectionPath(id)` pour un lien */
  collection: '/collections/:id',
  /** Ajout d'une carte ; utiliser `addCardPath(collectionId)` pour présélectionner une collection */
  addCard: '/cartes/ajouter',
  /** Profil de l'utilisateur */
  profile: '/profil',
} as const;

/** Paramètre de `ROUTES.addCard` qui présélectionne la collection de destination. */
export const ADD_CARD_COLLECTION_PARAM = 'collection';

/**
 * Chemin du détail d'une collection.
 * @param collectionId - Identifiant de la collection, encodé dans l'URL
 */
export function collectionPath(collectionId: string): string {
  return ROUTES.collection.replace(':id', encodeURIComponent(collectionId));
}

/**
 * Chemin de l'ajout d'une carte, avec ou sans collection présélectionnée.
 * @param collectionId - Collection de destination, facultative
 */
export function addCardPath(collectionId?: string): string {
  if (collectionId === undefined) {
    return ROUTES.addCard;
  }
  const query = new URLSearchParams({ [ADD_CARD_COLLECTION_PARAM]: collectionId });
  return `${ROUTES.addCard}?${query.toString()}`;
}
