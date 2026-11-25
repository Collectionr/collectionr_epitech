import { useCallback, useEffect } from 'react';

import { useAuthService } from './authServiceContext';

/**
 * Lance la restauration de la session au montage. Le service ne la mène qu'une fois par
 * chargement : appeler ce hook à plusieurs endroits, ou deux fois sous `StrictMode`, est sans effet.
 * @returns Relance la restauration après un échec (serveur injoignable)
 */
export function useRestoreSession(): () => void {
  const authService = useAuthService();

  useEffect(() => {
    void authService.restoreSession();
  }, [authService]);

  return useCallback(() => {
    void authService.restoreSession();
  }, [authService]);
}
