import { useEffect, useState } from 'react';

import { useAuthService } from './authServiceContext';

/**
 * À appeler sur l'écran de connexion : indique s'il faut signaler une session expirée. La raison de
 * fermeture (expiration ou déconnexion) est lue au montage puis acquittée dans le store : le message
 * reste affiché sur cet écran sans réapparaître à la visite suivante, et une déconnexion passée ne
 * change plus les redirections suivantes.
 * @returns `true` si la session a expiré en cours d'usage juste avant l'arrivée sur l'écran
 */
export function useSessionExpiredNotice(): boolean {
  const { store } = useAuthService();
  const [expired] = useState(() => store.getState().endReason === 'expired');

  useEffect(() => {
    if (store.getState().endReason !== null) {
      store.getState().acknowledgeEndReason();
    }
  }, [store]);

  return expired;
}
