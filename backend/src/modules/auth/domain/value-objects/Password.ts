import { DomainValidationError } from '../errors/DomainValidationError';

// Unicode-aware rather than [A-Za-z]/[0-9]: a password made only of non-Latin
// letters and digits (e.g. "パスワード1234") is not weaker and must not be
// rejected for using a different script. \p{Nd} (decimal digits), not \p{N}:
// "①", "½" or roman numerals are not digits a user can be expected to type.
// Kept fixed in code (not configurable): a security-reviewed rule, not an
// environment-specific value.
const LETTER = /\p{L}/u;
const DIGIT = /\p{Nd}/u;

function assertPositiveInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid password policy: ${name} must be a positive integer`);
  }
}

/** Holds a plaintext password that satisfies the policy, only for the time it takes to hash it. */
export class Password {
  private constructor(public readonly value: string) {}

  /**
   * `minLength` comes from PASSWORD_MIN_LENGTH (EnvironmentVariables.ts) and `maxBytes` from the
   * password hasher (IPasswordHasher.maxPasswordBytes), both via the caller: the domain knows
   * neither the environment nor the hashing algorithm. A missing or malformed value is a deployment
   * bug, not a bad user input: it fails closed with a plain Error (never a DomainValidationError,
   * which is mapped to a 4xx) instead of silently disabling a rule.
   */
  static create(raw: string, minLength: number, maxBytes: number): Password {
    assertPositiveInteger(minLength, 'minLength');
    assertPositiveInteger(maxBytes, 'maxBytes');

    if (raw.length < minLength) {
      throw new DomainValidationError(`Password must be at least ${minLength} characters long`);
    }
    if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
      throw new DomainValidationError(`Password must be at most ${maxBytes} bytes long`);
    }
    // Some hashing implementations stop at a NUL byte, others do not: switching
    // implementation later would silently weaken such passwords.
    if (raw.includes('\u0000')) {
      throw new DomainValidationError('Password must not contain a null character');
    }
    if (!LETTER.test(raw) || !DIGIT.test(raw)) {
      throw new DomainValidationError('Password must contain at least one letter and one digit');
    }

    return new Password(raw);
  }
}
