import { useCallback, useState } from 'react';

import { Outlet, useLocation } from 'react-router';

import type { SidebarDestinations } from '@/components/organisms';
import { AppLayout } from '@/components/templates';
import { APP_NAME } from '@shared/constants';
import { useAuth } from '@shared/hooks';

import { ROUTES } from './routes';
import { PageTitleContext } from './usePageTitle';

/** Destinations de la Sidebar : pages de l'application web. */
const SIDEBAR_DESTINATIONS: SidebarDestinations = {
  dashboard: ROUTES.dashboard,
  catalogue: ROUTES.catalogue,
  collection: ROUTES.collections,
  setProgression: ROUTES.setProgression,
  addCard: ROUTES.addCard,
  preGrading: ROUTES.preGrading,
  profile: ROUTES.profile,
  settings: ROUTES.settings,
};

/** Titre fourni par une page, rattaché à son chemin. */
interface PageTitle {
  pathname: string;
  title: string;
}

/**
 * Cadre des pages connectées (AppLayout), placé sous `RequireAuth`. Il reste affiché pendant le
 * chargement d'une page et sur son écran d'erreur : seule la zone de contenu attend.
 *
 * Chaque page fournit son titre par `usePageTitle`. Tant que la page affichée n'a pas fourni le
 * sien (chargement, erreur), la Topbar affiche le nom de l'application, jamais celui de la page
 * précédente.
 */
export function ConnectedLayout() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [pageTitle, setPageTitle] = useState<PageTitle | null>(null);
  const providePageTitle = useCallback((pagePathname: string, title: string) => {
    setPageTitle({ pathname: pagePathname, title });
  }, []);
  const title = pageTitle?.pathname === pathname ? pageTitle.title : APP_NAME;

  return (
    <PageTitleContext.Provider value={providePageTitle}>
      <AppLayout
        title={title}
        currentPath={pathname}
        destinations={SIDEBAR_DESTINATIONS}
        user={{ name: user?.username ?? '' }}
      >
        <Outlet />
      </AppLayout>
    </PageTitleContext.Provider>
  );
}
