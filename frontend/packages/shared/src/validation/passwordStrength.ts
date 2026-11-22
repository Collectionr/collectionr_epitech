/**
 * Politique de mot de passe et robustesse, partagées web et mobile (COLLR-583).
 * La politique reprend à l'identique celle du backend (COLLR-414) :
 * `backend/src/modules/auth/domain/value-objects/Password.ts`.
 */

/**
 * Longueur minimale, en unités UTF-16 (`String.length`, comme le backend).
 * Copiée du backend : `PASSWORD_MIN_LENGTH` (variable d'environnement, 8 par défaut).
 * Si le backend relève cette valeur, ce minimum doit suivre.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Taille maximale en octets UTF-8, limite de bcrypt côté backend (`BcryptPasswordHasher`). */
export const PASSWORD_MAX_BYTES = 72;

/** Niveaux de robustesse, du plus faible au plus solide. */
export type PasswordStrength = 'faible' | 'correct' | 'solide';

/** Libellés affichés à côté de la jauge, sur le web comme sur mobile. */
export const PASSWORD_STRENGTH_LABELS: Record<PasswordStrength, string> = {
  faible: 'Faible',
  correct: 'Correct',
  solide: 'Solide',
};

/** Solide sans condition de familles : phrase de passe, ou écriture sans majuscules (japonais…). */
const SOLID_PASSPHRASE_LENGTH = 16;

/** Solide à partir de cette longueur si le mot de passe mêle assez de familles de caractères. */
const SOLID_MIXED_LENGTH = 12;
const SOLID_MIN_FAMILIES = 3;

/** Caractères distincts (points de code) exigés pour Solide : écarte « aaaaaaaaaaaaaaa1 ». */
const SOLID_MIN_DISTINCT_CHARACTERS = 6;

/** Lettre et chiffre au sens Unicode, comme le backend (`\p{Nd}` : chiffres décimaux seulement). */
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

/** Familles comptées pour le niveau Solide : minuscules, majuscules, chiffres, autres caractères. */
const CHARACTER_FAMILIES = [/\p{Ll}/u, /\p{Lu}/u, DIGIT, /[^\p{L}\p{Nd}]/u];

const NULL_CHARACTER = '\u0000';

/** Plus grands points de code encodés sur 1, 2 et 3 octets en UTF-8. */
const UTF8_ONE_BYTE_MAX = 0x7f;
const UTF8_TWO_BYTES_MAX = 0x7ff;
const UTF8_THREE_BYTES_MAX = 0xffff;

/**
 * Taille UTF-8 d'une chaîne, calculée sans `TextEncoder` ni `Buffer` (aucune API de plateforme).
 * Une moitié de paire de substitution isolée compte 3 octets, comme son remplacement par U+FFFD.
 */
function utf8ByteLength(value: string): number {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= UTF8_ONE_BYTE_MAX) {
      bytes += 1;
    } else if (codePoint <= UTF8_TWO_BYTES_MAX) {
      bytes += 2;
    } else if (codePoint <= UTF8_THREE_BYTES_MAX) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }
  return bytes;
}

/**
 * Indique si le mot de passe respecte la politique du backend : au moins 8 caractères,
 * au plus 72 octets UTF-8, aucun caractère nul, au moins une lettre et un chiffre.
 * @param password - Mot de passe saisi
 * @returns `true` si le backend l'accepterait
 */
export function meetsPasswordPolicy(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    utf8ByteLength(password) <= PASSWORD_MAX_BYTES &&
    !password.includes(NULL_CHARACTER) &&
    LETTER.test(password) &&
    DIGIT.test(password)
  );
}

/**
 * Calcule la robustesse d'un mot de passe, à chaque frappe.
 * - Faible : la politique du backend n'est pas respectée ;
 * - Correct : la politique est respectée ;
 * - Solide : la politique est respectée, au moins 6 caractères distincts (comptés par point de
 *   code), et 16 caractères ou plus, ou 12 caractères ou plus mêlant au moins 3 familles
 *   (minuscules, majuscules, chiffres, autres caractères). Sous 6 caractères distincts, le niveau
 *   plafonne à Correct, quelle que soit la longueur.
 * @param password - Mot de passe saisi
 * @returns Le niveau, ou `null` tant que rien n'est saisi
 */
export function getPasswordStrength(password: string): PasswordStrength | null {
  if (password === '') {
    return null;
  }
  if (!meetsPasswordPolicy(password)) {
    return 'faible';
  }
  // L'itérateur de chaîne parcourt les points de code : un emoji compte pour un caractère.
  if (new Set(password).size < SOLID_MIN_DISTINCT_CHARACTERS) {
    return 'correct';
  }
  if (password.length >= SOLID_PASSPHRASE_LENGTH) {
    return 'solide';
  }
  const familyCount = CHARACTER_FAMILIES.filter((family) => family.test(password)).length;
  return password.length >= SOLID_MIXED_LENGTH && familyCount >= SOLID_MIN_FAMILIES
    ? 'solide'
    : 'correct';
}
