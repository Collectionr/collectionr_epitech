import { lazy, Suspense } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
// Pas react-router/dom : sous Vitest il charge un second build (double contexte), et flushSync est inutilisé.
import { RouterProvider } from 'react-router';

import { authService, collectionService } from '@/config/api';
import { queryClient } from '@/config/queryClient';
import { router } from '@/router/router';
import { AuthServiceContext, CollectionServiceContext } from '@shared/hooks';

/**
 * Devtools de TanStack Query, chargées à la demande sous `vite dev` uniquement : le build de
 * production remplace la condition par `false` et n'embarque pas le module, les tests ne le chargent pas.
 */
const QueryDevtools =
  import.meta.env.DEV && import.meta.env.MODE !== 'test'
    ? lazy(() =>
        import('@tanstack/react-query-devtools').then((module) => ({
          default: module.ReactQueryDevtools,
        })),
      )
    : null;

/** Racine de l'application web : cache des appels API, services de l'API et routeur. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthServiceContext.Provider value={authService}>
        <CollectionServiceContext.Provider value={collectionService}>
          <RouterProvider router={router} />
        </CollectionServiceContext.Provider>
      </AuthServiceContext.Provider>
      {QueryDevtools && (
        <Suspense fallback={null}>
          <QueryDevtools />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
