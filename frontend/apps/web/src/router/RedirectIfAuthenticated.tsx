import { Navigate, Outlet, useSearchParams } from 'react-router';

import { useAuth, useRestoreSession } from '@shared/hooks';

import { getSafeRedirect, REDIRECT_PARAM, ROUTES } from './routes';
import { StartupScreen } from './StartupScreen';

/**
 * Routes réservées aux visiteurs (connexion, inscription). Session indéterminée : écran de
 * démarrage (ou d'erreur), pour que le formulaire n'apparaisse pas un instant chez un utilisateur
 * déjà connecté. Utilisateur connecté : page demandée (`redirect`), sinon Dashboard ; c'est aussi
 * ce qui redirige juste après une connexion réussie.
 */
export function RedirectIfAuthenticated() {
  const { status, restoreError } = useAuth();
  const retryRestore = useRestoreSession();
  const [searchParams] = useSearchParams();

  if (status === 'unknown') {
    return <StartupScreen error={restoreError} onRetry={retryRestore} />;
  }
  if (status === 'authenticated') {
    return (
      <Navigate
        replace
        to={getSafeRedirect(searchParams.get(REDIRECT_PARAM)) ?? ROUTES.dashboard}
      />
    );
  }
  return <Outlet />;
}
