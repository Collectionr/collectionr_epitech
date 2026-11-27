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

/** Paramètre de `ROUTES.login` qui porte la page demandée avant la connexion. */
export const REDIRECT_PARAM = 'redirect';

/** Origine fictive, pour vérifier qu'un `redirect` résolu reste sur le site. */
const REDIRECT_CHECK_ORIGIN = 'https://collectionr.invalid';

/** Pages réservées aux visiteurs : y renvoyer un utilisateur connecté bouclerait. */
const PUBLIC_ONLY_PATHS: ReadonlySet<string> = new Set([
  ROUTES.login,
  ROUTES.signup,
  ROUTES.forgotPassword,
]);

/**
 * Chemin de la connexion, avec la page à retrouver après la connexion. Le Dashboard, destination
 * par défaut, n'est pas répété dans l'URL.
 * @param redirectTo - Page demandée (chemin, paramètres et ancre), facultative
 */
export function loginPath(redirectTo?: string): string {
  if (redirectTo === undefined || redirectTo === ROUTES.dashboard) {
    return ROUTES.login;
  }
  const query = new URLSearchParams({ [REDIRECT_PARAM]: redirectTo });
  return `${ROUTES.login}?${query.toString()}`;
}

/**
 * Page de retour après connexion, si elle est sûre : un chemin (commençant par `/`) qui, résolu
 * comme le fait le navigateur, reste sur le site, hors pages réservées aux visiteurs. La
 * résolution par `URL` écarte aussi les formes que le navigateur réécrit vers un autre site :
 * `//hôte`, `/\\hôte`, ou `/<tabulation>/hôte` (tabulations et sauts de ligne sont retirés).
 * @param value - Valeur du paramètre `redirect`
 * @returns Le chemin résolu (chemin, paramètres et ancre), ou `null` s'il est absent ou refusé
 */
export function getSafeRedirect(value: string | null): string | null {
  if (value === null || !value.startsWith('/')) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value, REDIRECT_CHECK_ORIGIN);
  } catch {
    // `//[` et autres hôtes illisibles.
    return null;
  }
  if (url.origin !== REDIRECT_CHECK_ORIGIN || PUBLIC_ONLY_PATHS.has(url.pathname)) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
