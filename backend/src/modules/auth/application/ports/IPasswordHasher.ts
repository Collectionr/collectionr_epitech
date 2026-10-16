export const PASSWORD_HASHER = 'PASSWORD_HASHER';

/**
 * Application port: the hashing algorithm (bcrypt, argon2...) is an infrastructure concern, and
 * so is everything that depends on it. The use cases only state the rules; the hasher knows the
 * numbers.
 *
 * Contract every implementation MUST honor:
 * - verify() accepts any hash string without throwing (false for one it cannot parse), and answers
 *   false for a password longer than maxPasswordBytes instead of silently comparing a truncated one.
 * - getDummyHash() is what LoginUserUseCase compares against when the account does not exist, so an
 *   unknown account costs as much as a known one. Only the hasher knows its own work factor, so only
 *   it can provide a hash guaranteed to cost the same as the ones hash() produces (a constant
 *   hardcoded elsewhere drifts silently when the cost or the algorithm changes). It is a throwaway
 *   value no password verifies against, ideally computed once at startup.
 * - maxPasswordBytes is the longest password (UTF-8 bytes) the algorithm takes into account in
 *   full. Password.create refuses anything longer: bcrypt reads 72 bytes and ignores the rest, which
 *   would make "<72 bytes>ANYTHING" a valid password; an algorithm without such a limit still
 *   needs a ceiling so one request cannot make the server hash megabytes.
 */
export interface IPasswordHasher {
  readonly maxPasswordBytes: number;
  hash(plainPassword: string): Promise<string>;
  verify(plainPassword: string, passwordHash: string): Promise<boolean>;
  getDummyHash(): string;
}
