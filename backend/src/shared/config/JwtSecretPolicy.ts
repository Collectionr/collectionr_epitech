const MIN_DISTINCT_CHARACTERS = 10;

/** A value copied from an example file or a README is public, whatever its length. */
const PLACEHOLDER_PATTERN =
  /replace[-_ ]?me|change[-_ ]?me|your[-_ ]?(jwt[-_ ]?)?secret|placeholder|put[-_ ]?a[-_ ]?secret|insert[-_ ]?secret|example[-_ ]?secret/i;

/** "abcabcabcabc…": a short block repeated to the full length. */
const REPEATED_BLOCK_PATTERN = /^(.{1,16})\1+$/s;

/**
 * Why a JWT signing secret is unfit even though it is long enough, or null when it is fine. The
 * length check alone accepts the placeholder from .env.example and 32 times the same letter, and a
 * guessable signing key lets anyone mint tokens for any user.
 */
export function weakSecretReason(secret: string): string | null {
  if (PLACEHOLDER_PATTERN.test(secret)) {
    return 'JWT_SECRET looks like a placeholder; generate one (e.g. openssl rand -hex 32)';
  }
  if (new Set(secret).size < MIN_DISTINCT_CHARACTERS) {
    return `JWT_SECRET must contain at least ${MIN_DISTINCT_CHARACTERS} distinct characters`;
  }
  if (REPEATED_BLOCK_PATTERN.test(secret)) {
    return 'JWT_SECRET is a short block repeated; generate a random one (e.g. openssl rand -hex 32)';
  }
  return null;
}
