import { createApiClient } from '@shared/services';

const DEFAULT_API_BASE_URL = '/api/v1';

/** Client API de l'application web, sur `VITE_API_BASE_URL` ou `/api/v1` par défaut. */
export const apiClient = createApiClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  fetch,
});
