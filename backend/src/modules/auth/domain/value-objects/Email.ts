import isEmail from 'validator/lib/isEmail';

// RFC 5321 §4.5.3.1.3 — validator's own default already enforces this, kept
// here as an explicit, cheap guard before running the full grammar check.
const EMAIL_MAX_LENGTH = 254;

export class Email {
  private constructor(public readonly value: string) {}

  /**
   * Delegates the actual grammar (quoted local parts, IP-literal domains,
   * consecutive/trailing dots, IDN domains, length limits...) to validator.js
   * rather than a hand-rolled regex — email addresses are notoriously easy
   * to under- or over-validate by hand.
   */
  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length === 0 || normalized.length > EMAIL_MAX_LENGTH || !isEmail(normalized)) {
      throw new Error(`Invalid email address: "${raw}"`);
    }

    return new Email(normalized);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
