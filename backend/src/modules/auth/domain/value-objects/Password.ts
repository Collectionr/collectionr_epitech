import { DomainValidationError } from '../errors/DomainValidationError';

/**
 * bcrypt silently ignores anything past 72 BYTES (not characters) — reject
 * longer inputs instead of truncating them. This is an algorithm constraint,
 * not a policy choice, so unlike minLength it is NOT configurable: raising it
 * via config would not raise bcrypt's actual limit, it would just let this
 * check silently stop protecting against truncation.
 */
const PASSWORD_MAX_LENGTH_BYTES = 72;

// Unicode-aware rather than [A-Za-z]/[0-9]: a password made only of non-Latin
// letters and digits (e.g. "パスワード1234") is not weaker and must not be
// rejected for using a different script. \p{Nd} (decimal digits), not \p{N}:
// "①", "½" or roman numerals are not digits a user can be expected to type.
// Kept fixed in code (not configurable): a security-reviewed rule, not an
// environment-specific value.
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

/** Holds a plaintext password that satisfies the policy, only for the time it takes to hash it. */
export class Password {
  private constructor(public readonly value: string) {}

  /**
   * `minLength` comes from PASSWORD_MIN_LENGTH (EnvironmentVariables.ts) via the caller — the
   * domain stays config-agnostic. A missing or malformed value is a deployment bug, not a bad
   * user input: it fails closed with a plain Error (never a DomainValidationError, which is
   * mapped to a 4xx) instead of silently disabling the length rule.
   */
  static create(raw: string, minLength: number): Password {
    if (!Number.isInteger(minLength) || minLength < 1) {
      throw new Error('Invalid password policy: minLength must be a positive integer');
    }
    if (raw.length < minLength) {
      throw new DomainValidationError(`Password must be at least ${minLength} characters long`);
    }
    if (Buffer.byteLength(raw, 'utf8') > PASSWORD_MAX_LENGTH_BYTES) {
      throw new DomainValidationError(
        `Password must be at most ${PASSWORD_MAX_LENGTH_BYTES} bytes long`,
      );
    }
    // Some bcrypt implementations stop hashing at a NUL byte, others do not:
    // switching implementation later would silently weaken such passwords.
    if (raw.includes('\u0000')) {
      throw new DomainValidationError('Password must not contain a null character');
    }
    if (!LETTER.test(raw) || !DIGIT.test(raw)) {
      throw new DomainValidationError('Password must contain at least one letter and one digit');
    }

    return new Password(raw);
  }
}
