export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/**
 * Application port: the hashing algorithm (bcrypt, per docs/security/S04-rgpd-conformite.md)
 * is an infrastructure concern.
 *
 * Contract: verify() must accept any hash string without throwing (return false for
 * one it cannot parse), and its cost must not depend on whether the hash is real.
 *
 * getDummyHash() is what LoginUserUseCase compares against when the account does not exist, so an
 * unknown account costs as much as a known one. Only the hasher knows its own work factor, so only
 * the hasher can provide a hash that is guaranteed to cost the same as the ones hash() produces
 * (a constant hardcoded elsewhere drifts silently when the cost changes). It is a throwaway
 * value no password verifies against, computed once at startup.
 */
export interface IPasswordHasher {
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
  getDummyHash(): string;
}
