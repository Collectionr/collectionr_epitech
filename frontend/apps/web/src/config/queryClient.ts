import { clearCacheOnSessionEnd, createQueryClient } from '@shared/services';

import { authService } from './api';

/** Cache des appels API de l'application web, unique pour toute l'application. */
export const queryClient = createQueryClient();

// Toute fin de session vide le cache : rien ne reste d'un compte pour le suivant.
clearCacheOnSessionEnd(authService.store, queryClient);
