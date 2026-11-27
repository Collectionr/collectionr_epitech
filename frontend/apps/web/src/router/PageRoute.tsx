import { Suspense } from 'react';
import type { ComponentType } from 'react';

import { DelayedLoadingLabel } from './DelayedLoadingLabel';
import { RouteErrorBoundary } from './RouteErrorBoundary';

/** Propriétés de PageRoute. */
export interface PageRouteProps {
  /** Page, chargée à la demande (`lazy`). */
  page: ComponentType;
}

/**
 * Enveloppe commune à chaque page : error boundary et attente du chargement. Seule la zone de la
 * page attend ou affiche l'erreur ; ce qui l'entoure (futur AppLayout) reste affiché.
 */
export function PageRoute({ page: Page }: PageRouteProps) {
  return (
    <RouteErrorBoundary>
      <Suspense fallback={<DelayedLoadingLabel />}>
        <Page />
      </Suspense>
    </RouteErrorBoundary>
  );
}
