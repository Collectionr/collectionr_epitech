import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '../errors/DomainValidationError';
import type { Email } from '../value-objects/Email';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;

// Control, format (zero-width, bidi overrides) and line/paragraph separators:
// invisible characters let two usernames look identical. A regular space is allowed.
const USERNAME_FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export interface NewUserProps {
  readonly email: Email;
  readonly passwordHash: string;
  readonly username: string;
  /** RGPD scaffold: the moment the user accepted the terms of service at registration. */
  readonly consentGivenAt: Date;
}

export interface UserProps extends NewUserProps {
  readonly id: string;
  /** A deactivated account (admin action, CDC §3.5) must not be able to log in. */
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly passwordHash: string,
    public readonly username: string,
    public readonly consentGivenAt: Date,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Exposed so callers can reject a bad username before paying for a password hash. */
  static assertValidUsername(username: string): void {
    const trimmed = username.trim();
    if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
      throw new DomainValidationError(
        `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long`,
      );
    }
    if (USERNAME_FORBIDDEN_CHARACTERS.test(trimmed)) {
      throw new DomainValidationError('Username must not contain control or invisible characters');
    }
  }

  static register(props: NewUserProps): User {
    User.assertValidUsername(props.username);
    const now = new Date();

    return new User(
      randomUUID(),
      props.email,
      props.passwordHash,
      props.username.trim(),
      props.consentGivenAt,
      true,
      now,
      now,
    );
  }

  /**
   * Rebuilds a User from data already persisted (used by repository
   * implementations). Deliberately does not re-validate: stored data was valid
   * under the rules of its time, and tightening a rule later must not make
   * existing accounts impossible to load.
   */
  static restore(props: UserProps): User {
    return new User(
      props.id,
      props.email,
      props.passwordHash,
      props.username.trim(),
      props.consentGivenAt,
      props.isActive,
      props.createdAt,
      props.updatedAt,
    );
  }

  withPasswordHash(passwordHash: string): User {
    return new User(
      this.id,
      this.email,
      passwordHash,
      this.username,
      this.consentGivenAt,
      this.isActive,
      this.createdAt,
      new Date(),
    );
  }

  withUsername(username: string): User {
    User.assertValidUsername(username);

    return new User(
      this.id,
      this.email,
      this.passwordHash,
      username.trim(),
      this.consentGivenAt,
      this.isActive,
      this.createdAt,
      new Date(),
    );
  }
}
