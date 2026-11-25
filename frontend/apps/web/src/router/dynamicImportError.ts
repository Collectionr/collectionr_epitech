/**
 * Messages des navigateurs et de Vite quand le fichier d'une page chargée à la demande ne peut pas
 * être importé : Chrome et Edge, Firefox, Safari, puis le préchargement CSS de Vite.
 */
const DYNAMIC_IMPORT_FAILURE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

/**
 * Indique si l'erreur vient de l'import dynamique d'une page : fichier introuvable (nouveau
 * déploiement qui a renommé les fichiers) ou réseau coupé pendant son chargement. React garde en
 * mémoire l'échec d'un `lazy()` : seul un rechargement de la page relance cet import.
 * @param error - Erreur interceptée par la boundary
 */
export function isDynamicImportError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'ChunkLoadError' || DYNAMIC_IMPORT_FAILURE.test(error.message);
}
