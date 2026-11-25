import { createQueryClient } from '@shared/services';

/** Cache des appels API de l'application web, unique pour toute l'application. */
export const queryClient = createQueryClient();
