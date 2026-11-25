import { Outlet } from 'react-router';

import { useRestoreSession } from '@shared/hooks';

import { useInternalLinkNavigation } from './internalLinks';

/**
 * Racine de toutes les routes : lance la restauration de la session (une fois par chargement),
 * branche la navigation des liens internes, puis affiche la route.
 */
export function RootLayout() {
  useRestoreSession();
  useInternalLinkNavigation();

  return <Outlet />;
}
