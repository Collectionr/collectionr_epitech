const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(public readonly value: string) {}

  static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length === 0 || normalized.length > EMAIL_MAX_LENGTH) {
      throw new Error(`Invalid email address: "${raw}"`);
    }
    if (!EMAIL_PATTERN.test(normalized)) {
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
