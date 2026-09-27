/**
 * bcrypt silently ignores anything past 72 BYTES (not characters) — reject
 * longer inputs instead of truncating them. This is an algorithm constraint,
 * not a policy choice, so unlike minLength it is NOT configurable: raising it
 * via config would not raise bcrypt's actual limit, it would just let this
 * check silently stop protecting against truncation.
 */
const PASSWORD_MAX_LENGTH_BYTES = 72;

// Unicode-aware (\p{L}/\p{N}) rather than [A-Za-z]/\d: a password made only
// of non-Latin letters (e.g. "パスワード1234") is not weaker and must not be
// rejected for using a different script. Kept fixed in code (not configurable):
// it is a security-reviewed rule, not an environment-specific value.
const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*\p{L})(?=.*\p{N}).+$/u;

/** Holds a plaintext password that satisfies the policy, only for the time it takes to hash it. */
export class Password {
  private constructor(public readonly value: string) {}

  /** `minLength` comes from PASSWORD_MIN_LENGTH (EnvironmentVariables.ts) via the caller — the domain stays config-agnostic. */
  static create(raw: string, minLength: number): Password {
    if (raw.length < minLength) {
      throw new Error(`Password must be at least ${minLength} characters long`);
    }
    if (Buffer.byteLength(raw, 'utf8') > PASSWORD_MAX_LENGTH_BYTES) {
      throw new Error(`Password must be at most ${PASSWORD_MAX_LENGTH_BYTES} bytes long`);
    }
    if (!PASSWORD_COMPLEXITY_PATTERN.test(raw)) {
      throw new Error('Password must contain at least one letter and one digit');
    }

    return new Password(raw);
  }
}
