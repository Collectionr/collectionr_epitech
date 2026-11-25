import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth, useRestoreSession } from '@shared/hooks';

import { loginPath, ROUTES } from './routes';
import { StartupScreen } from './StartupScreen';

/**
 * Routes réservées aux utilisateurs connectés. Session indéterminée : écran de démarrage (ou
 * d'erreur). Visiteur anonyme : connexion, avec la page demandée pour y revenir ensuite, sauf après
 * une déconnexion volontaire.
 */
export function RequireAuth() {
  const { status, endReason, restoreError } = useAuth();
  const retryRestore = useRestoreSession();
  const location = useLocation();

  if (status === 'unknown') {
    return <StartupScreen error={restoreError} onRetry={retryRestore} />;
  }
  if (status === 'anonymous') {
    const requestedPath = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate replace to={endReason === 'logout' ? ROUTES.login : loginPath(requestedPath)} />
    );
  }
  return <Outlet />;
}
