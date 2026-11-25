import { ApiError, NetworkError } from '../services/apiClient';

/** Champ d'un formulaire d'authentification auquel une erreur peut être rattachée. */
export type AuthErrorField = 'email' | 'username';

/** Erreur d'authentification traduite, prête à afficher. */
export interface TranslatedAuthError {
  /** Message en français */
  message: string;
  /** Champ concerné, quand l'erreur porte sur un champ précis ; sinon message général */
  field?: AuthErrorField;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVICE_UNAVAILABLE = 503;
const SECONDS_PER_MINUTE = 60;

/**
 * Messages 409 du back, rattachés à un champ ou à un message dédié. Ils dépendent des messages
 * actuels du back (`backend/src/modules/auth/application/errors/AuthErrors.ts`), qui ne renvoie pas
 * de code d'erreur par champ : si ces textes changent, le 409 retombe sur le message général.
 */
const CONFLICT_MESSAGES: Readonly<Record<string, TranslatedAuthError>> = {
  'Email is already registered': {
    message: 'Cette adresse e-mail est déjà utilisée.',
    field: 'email',
  },
  'Username is already taken': { message: 'Ce pseudo est déjà pris.', field: 'username' },
  'The terms of service have changed; review the current version before accepting': {
    message: 'Les conditions d’utilisation ont changé : relisez-les avant de les accepter.',
  },
};

const MESSAGES = {
  invalidCredentials: 'Adresse e-mail ou mot de passe incorrect.',
  invalidInput: 'Vérifiez les informations saisies.',
  conflict: 'Vos informations ont été modifiées entre-temps. Réessayez.',
  tooManyAttempts: 'Trop de tentatives.',
  retryLater: 'Réessayez dans quelques minutes.',
  unavailable: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.',
  offline: 'Connexion au serveur impossible. Vérifiez votre connexion internet.',
  timeout: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
  unexpected: 'Une erreur est survenue. Réessayez dans un instant.',
} as const;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count > 1 ? 's' : ''}`;
}

/** « Réessayez dans 45 secondes », ou en minutes arrondies au-dessus à partir d'une minute. */
function retryDelayMessage(retryAfterSeconds: number | undefined): string {
  if (retryAfterSeconds === undefined || retryAfterSeconds <= 0) {
    return MESSAGES.retryLater;
  }
  if (retryAfterSeconds < SECONDS_PER_MINUTE) {
    return `Réessayez dans ${plural(retryAfterSeconds, 'seconde')}.`;
  }
  return `Réessayez dans ${plural(Math.ceil(retryAfterSeconds / SECONDS_PER_MINUTE), 'minute')}.`;
}

function translateApiError(error: ApiError): TranslatedAuthError {
  switch (error.status) {
    case HTTP_UNAUTHORIZED:
      return { message: MESSAGES.invalidCredentials };
    case HTTP_BAD_REQUEST:
      return { message: MESSAGES.invalidInput };
    case HTTP_CONFLICT:
      return CONFLICT_MESSAGES[error.message] ?? { message: MESSAGES.conflict };
    case HTTP_TOO_MANY_REQUESTS:
      return {
        message: `${MESSAGES.tooManyAttempts} ${retryDelayMessage(error.retryAfterSeconds)}`,
      };
    case HTTP_SERVICE_UNAVAILABLE:
      return { message: MESSAGES.unavailable };
    default:
      return { message: MESSAGES.unexpected };
  }
}

/**
 * Traduit en français une erreur de connexion ou d'inscription. Les messages du back, en anglais,
 * ne sont jamais affichés tels quels.
 * @param error - Erreur levée par `authService.login` ou `authService.register`
 * @returns Le message à afficher, et le champ concerné pour un e-mail ou un pseudo déjà pris
 */
export function translateAuthError(error: unknown): TranslatedAuthError {
  if (error instanceof ApiError) {
    return translateApiError(error);
  }
  if (error instanceof NetworkError) {
    return { message: error.reason === 'timeout' ? MESSAGES.timeout : MESSAGES.offline };
  }
  return { message: MESSAGES.unexpected };
}
