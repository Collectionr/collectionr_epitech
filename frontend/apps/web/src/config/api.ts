import { createApiClient } from '@shared/services';

const DEFAULT_API_BASE_URL = '/api/v1';
/** Chemin du même domaine (Ingress, proxy de dev) : un seul "/" initial, pas une URL "//hôte". */
const SAME_ORIGIN_PATH = /^\/(?!\/)/;
const ABSOLUTE_HTTP_URL = /^https?:\/\/\S+$/;

/**
 * Valide l'URL de base de l'API figée au build.
 * @param value - Valeur de `VITE_API_BASE_URL`, éventuellement absente ou vide
 * @returns La valeur reçue, ou `/api/v1` si elle est absente ou vide
 * @throws {Error} Si la valeur n'est ni un chemin du même domaine ni une URL absolue en http(s)
 */
export function resolveApiBaseUrl(value: string | undefined): string {
  if (!value) {
    return DEFAULT_API_BASE_URL;
  }
  if (SAME_ORIGIN_PATH.test(value) || ABSOLUTE_HTTP_URL.test(value)) {
    return value;
  }
  throw new Error(
    `VITE_API_BASE_URL doit être un chemin commençant par / ou une URL absolue en http:// ou https:// (reçu : "${value}")`,
  );
}

/** Client API de l'application web, sur `VITE_API_BASE_URL` ou `/api/v1` par défaut. */
export const apiClient = createApiClient({
  baseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL),
  fetch,
  createAbortController: () => new AbortController(),
});
