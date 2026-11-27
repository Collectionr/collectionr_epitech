import { useEffect } from 'react';

import { APP_NAME } from '@shared/constants';

/**
 * Titre de l'onglet d'une page : « Ma Collection · Collectionr ».
 * @param pageTitle - Nom de la page
 */
export function formatDocumentTitle(pageTitle: string): string {
  return `${pageTitle} · ${APP_NAME}`;
}

/**
 * Met à jour le titre de l'onglet pour la page affichée. `document.title` est écrit directement :
 * le `<title>` d'index.html passerait avant un `<title>` rendu par React.
 * @param pageTitle - Nom de la page
 */
export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = formatDocumentTitle(pageTitle);
  }, [pageTitle]);
}
