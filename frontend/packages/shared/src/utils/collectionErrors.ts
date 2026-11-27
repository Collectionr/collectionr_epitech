import { ApiError, NetworkError } from '../services/apiClient';

const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR_MIN = 500;

/** Messages en français : ceux du back, en anglais, ne s'affichent jamais tels quels. */
const MESSAGES = {
  invalid: 'Ces informations ont été refusées. Vérifiez la carte, l’état et la quantité.',
  notFound: 'Cette carte ou cette collection n’existe plus. Rechargez la page.',
  tooManyAttempts: 'Trop de tentatives. Réessayez dans quelques minutes.',
  unavailable: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.',
  offline: 'Connexion au serveur impossible. Vérifiez votre connexion internet.',
  timeout: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
  unexpected: 'La carte n’a pas pu être ajoutée. Réessayez dans un instant.',
} as const;

/**
 * Message à afficher après l'échec d'un ajout à une collection.
 * @param error - Erreur levée par `collectionService.addCard`
 */
export function translateAddCardError(error: unknown): string {
  if (error instanceof NetworkError) {
    return error.reason === 'timeout' ? MESSAGES.timeout : MESSAGES.offline;
  }
  if (!(error instanceof ApiError)) {
    return MESSAGES.unexpected;
  }
  if (error.status === HTTP_BAD_REQUEST) {
    return MESSAGES.invalid;
  }
  if (error.status === HTTP_NOT_FOUND) {
    return MESSAGES.notFound;
  }
  if (error.status === HTTP_TOO_MANY_REQUESTS) {
    return MESSAGES.tooManyAttempts;
  }
  return error.status >= HTTP_SERVER_ERROR_MIN ? MESSAGES.unavailable : MESSAGES.unexpected;
}
