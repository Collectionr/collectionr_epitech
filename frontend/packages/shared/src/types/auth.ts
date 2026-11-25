/** Utilisateur, tel que renvoyé par l'API (`UserResponseDto`). */
export interface User {
  /** Identifiant (UUID) */
  id: string;
  /** Adresse e-mail */
  email: string;
  /** Pseudo affiché */
  username: string;
  /** Date de création du compte, au format ISO 8601 */
  createdAt: string;
}

/** Paire de jetons émise par `POST /auth/login` et `POST /auth/refresh`. */
export interface AuthTokens {
  /** Jeton d'accès, de courte durée, gardé en mémoire uniquement */
  accessToken: string;
  /** Jeton de renouvellement, à usage unique, persisté par l'application */
  refreshToken: string;
}

/** Identifiants de connexion. */
export interface LoginCredentials {
  /** Adresse e-mail */
  email: string;
  /** Mot de passe */
  password: string;
}

/** Données d'inscription (`POST /auth/register`). */
export interface RegisterInput {
  /** Adresse e-mail */
  email: string;
  /** Mot de passe, conforme à la politique du back */
  password: string;
  /** Pseudo, unique */
  username: string;
  /** Version des conditions d'utilisation affichée et acceptée par l'utilisateur */
  acceptedTermsVersion: string;
}

/** État de la session : inconnu tant que la restauration au démarrage n'a pas abouti. */
export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';
