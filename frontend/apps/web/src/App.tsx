import { lazy, Suspense } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/config/queryClient';
import { APP_NAME } from '@shared/constants';

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

/** Racine de l'application web. */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="p-space-24">
        <h1 className="text-h1">{APP_NAME}</h1>
      </main>
      {QueryDevtools && (
        <Suspense fallback={null}>
          <QueryDevtools />
        </Suspense>
      )}
    </QueryClientProvider>
  );
}
