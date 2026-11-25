import { meetsPasswordPolicy, PASSWORD_MIN_LENGTH } from './passwordStrength';

/**
 * Validation des formulaires de connexion et d'inscription, partagée web et mobile. Chaque fonction
 * renvoie le message d'erreur à afficher sous le champ, ou `undefined` si la valeur est valide.
 * L'unicité de l'e-mail et du pseudo ne se vérifie que côté back (409, voir `translateAuthError`).
 */

/** Longueur minimale du pseudo, sans les espaces en bordure. Copiée du back (`User.ts`). */
export const USERNAME_MIN_LENGTH = 3;
/** Longueur maximale du pseudo, sans les espaces en bordure. Copiée du back (`User.ts`). */
export const USERNAME_MAX_LENGTH = 32;

/** Forme minimale : un « @ » entre deux parties, et un point dans le domaine. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
/** Caractères de contrôle ou invisibles, refusés par le back dans un pseudo. */
const USERNAME_FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

/**
 * Valide une adresse e-mail.
 * @param email - Valeur saisie
 */
export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (trimmed === '') {
    return 'Saisissez votre adresse e-mail.';
  }
  return EMAIL_SHAPE.test(trimmed)
    ? undefined
    : 'Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.';
}

/**
 * Valide le mot de passe de connexion : seule sa présence est vérifiée, la politique ne
 * s'applique qu'à la création.
 * @param password - Valeur saisie
 */
export function validateLoginPassword(password: string): string | undefined {
  return password === '' ? 'Saisissez votre mot de passe.' : undefined;
}

/**
 * Valide un nouveau mot de passe selon la politique du back (COLLR-414) : au moins 8 caractères,
 * dont une lettre et un chiffre, au plus 72 octets, sans caractère nul.
 * @param password - Valeur saisie
 */
export function validateNewPassword(password: string): string | undefined {
  if (meetsPasswordPolicy(password)) {
    return undefined;
  }
  const hasRequiredContent =
    password.length >= PASSWORD_MIN_LENGTH && LETTER.test(password) && DIGIT.test(password);
  return hasRequiredContent
    ? 'Ce mot de passe est trop long ou contient un caractère non autorisé.'
    : `Utilisez au moins ${PASSWORD_MIN_LENGTH} caractères, dont une lettre et un chiffre.`;
}

/**
 * Valide un pseudo selon les règles du back : 3 à 32 caractères sans les espaces en bordure,
 * aucun caractère de contrôle ou invisible.
 * @param username - Valeur saisie
 */
export function validateUsername(username: string): string | undefined {
  const trimmed = username.trim();
  if (trimmed === '') {
    return 'Saisissez un pseudo.';
  }
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    return `Votre pseudo doit contenir entre ${USERNAME_MIN_LENGTH} et ${USERNAME_MAX_LENGTH} caractères.`;
  }
  return USERNAME_FORBIDDEN_CHARACTERS.test(trimmed)
    ? 'Votre pseudo contient un caractère non autorisé.'
    : undefined;
}
