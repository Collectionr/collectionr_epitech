import { createApiClient } from '@shared/services';

const ABSOLUTE_HTTP_URL = /^https?:\/\//;

const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error('EXPO_PUBLIC_API_URL est absente : la renseigner dans apps/mobile/.env');
}

if (!ABSOLUTE_HTTP_URL.test(apiUrl)) {
  throw new Error(
    `EXPO_PUBLIC_API_URL doit être une URL absolue en http:// ou https:// (reçu : "${apiUrl}")`,
  );
}

/** Client API de l'application mobile, sur `EXPO_PUBLIC_API_URL` (URL absolue, sans défaut). */
export const apiClient = createApiClient({
  baseUrl: apiUrl,
  fetch,
});
