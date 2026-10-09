export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/**
 * Application port: the hashing algorithm (bcrypt, per docs/security/S04-rgpd-conformite.md)
 * is an infrastructure concern.
 *
 * Contract: verify() must accept any hash string without throwing (return false for
 * one it cannot parse), and its cost must not depend on whether the hash is real.
 * LoginUserUseCase relies on this to keep unknown accounts as slow as known ones.
 * The dummy hash it passes must use the SAME cost factor as the one hash() produces
 * (a lower cost makes unknown accounts measurably faster and defeats the protection).
 */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
}
