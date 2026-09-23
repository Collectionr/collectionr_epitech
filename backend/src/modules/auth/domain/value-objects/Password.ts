const PASSWORD_MIN_LENGTH = 8;
/** bcrypt silently ignores anything past 72 bytes — reject longer inputs instead of truncating them. */
const PASSWORD_MAX_LENGTH = 72;
const PASSWORD_COMPLEXITY_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).+$/;

/** Holds a plaintext password that satisfies the policy, only for the time it takes to hash it. */
export class Password {
  private constructor(public readonly value: string) {}

  static create(raw: string): Password {
    if (raw.length < PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${PASSWORD_MIN_LENGTH} characters long`);
    }
    if (raw.length > PASSWORD_MAX_LENGTH) {
      throw new Error(`Password must be at most ${PASSWORD_MAX_LENGTH} characters long`);
    }
    if (!PASSWORD_COMPLEXITY_PATTERN.test(raw)) {
      throw new Error('Password must contain at least one letter and one digit');
    }

    return new Password(raw);
  }
}
