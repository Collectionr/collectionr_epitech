import { randomUUID } from 'node:crypto';
import type { Email } from '../value-objects/Email';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;

function assertValidUsername(username: string): void {
  const trimmed = username.trim();
  if (trimmed.length < USERNAME_MIN_LENGTH || trimmed.length > USERNAME_MAX_LENGTH) {
    throw new Error(
      `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long`,
    );
  }
}

export interface NewUserProps {
  readonly email: Email;
  readonly passwordHash: string;
  readonly username: string;
  /** RGPD scaffold: the moment the user accepted the terms of service at registration. */
  readonly consentGivenAt: Date;
}

export interface UserProps extends NewUserProps {
  readonly id: string;
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
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static register(props: NewUserProps): User {
    assertValidUsername(props.username);
    const now = new Date();

    return new User(
      randomUUID(),
      props.email,
      props.passwordHash,
      props.username.trim(),
      props.consentGivenAt,
      now,
      now,
    );
  }

  /** Rebuilds a User from data already persisted (used by repository implementations). */
  static restore(props: UserProps): User {
    assertValidUsername(props.username);

    return new User(
      props.id,
      props.email,
      props.passwordHash,
      props.username.trim(),
      props.consentGivenAt,
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
      this.createdAt,
      new Date(),
    );
  }

  withUsername(username: string): User {
    assertValidUsername(username);

    return new User(
      this.id,
      this.email,
      this.passwordHash,
      username.trim(),
      this.consentGivenAt,
      this.createdAt,
      new Date(),
    );
  }
}
