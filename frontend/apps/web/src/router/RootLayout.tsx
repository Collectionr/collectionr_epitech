import { Outlet } from 'react-router';

import { useInternalLinkNavigation } from './internalLinks';

/** Racine de toutes les routes : branche la navigation des liens internes, puis la route. */
export function RootLayout() {
  useInternalLinkNavigation();

  return <Outlet />;
}
