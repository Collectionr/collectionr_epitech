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
  /**
   * When the user accepted the terms of service at registration. This records acceptance of the
   * contract (S04 §4: authentication rests on contract performance), not an optional RGPD
   * consent: those belong to the CONSENT table (Beta).
   */
  readonly termsAcceptedAt: Date;
  /** The version of the terms that was shown and accepted: the proof of what the user agreed to. */
  readonly termsVersion: string;
}

export interface UserProps extends NewUserProps {
  readonly id: string;
  /** A deactivated account (admin action, CDC §3.5) must not be able to log in. */
  readonly isActive: boolean;
  /**
   * Optimistic lock: the version this copy was loaded at. A repository must refuse to save it if the
   * stored version moved on, otherwise a stale copy silently undoes a concurrent change (a password
   * change, a deactivation).
   */
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class User {
  private constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly passwordHash: string,
    public readonly username: string,
    public readonly termsAcceptedAt: Date,
    public readonly termsVersion: string,
    public readonly isActive: boolean,
    public readonly version: number,
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

  /**
   * What makes two usernames "the same": NFKC, lower case, runs of spaces collapsed. "Pokemon",
   * "pokemon" and "POKEMON" are one username, and so are "ash  ketchum" and "ash ketchum". A
   * repository enforces uniqueness on this key (IUserRepository.findByUsername/save), never on the
   * raw text. Look-alike letters from other scripts are NOT folded: that needs a confusables table.
   */
  static usernameKey(username: string): string {
    return username.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
  }

  static register(props: NewUserProps): User {
    User.assertValidUsername(props.username);
    // Not a user mistake: the use case checks the version the user sent against the current one
    // before getting here, so an empty one is a bug that must not be stored as "proof".
    if (props.termsVersion.trim() === '') {
      throw new Error('A user cannot be registered without the terms version they accepted');
    }
    const now = new Date();

    return new User(
      randomUUID(),
      props.email,
      props.passwordHash,
      props.username.trim(),
      props.termsAcceptedAt,
      props.termsVersion,
      true,
      0,
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
      props.termsAcceptedAt,
      props.termsVersion,
      props.isActive,
      props.version,
      props.createdAt,
      props.updatedAt,
    );
  }

  /**
   * An admin action (CDC §3.5): the account can no longer log in. Whoever deactivates must also
   * revoke the account's sessions (see DeactivateUserUseCase): this only flips the flag.
   */
  deactivate(): User {
    return new User(
      this.id,
      this.email,
      this.passwordHash,
      this.username,
      this.termsAcceptedAt,
      this.termsVersion,
      false,
      this.version,
      this.createdAt,
      new Date(),
    );
  }

  withPasswordHash(passwordHash: string): User {
    return new User(
      this.id,
      this.email,
      passwordHash,
      this.username,
      this.termsAcceptedAt,
      this.termsVersion,
      this.isActive,
      this.version,
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
      this.termsAcceptedAt,
      this.termsVersion,
      this.isActive,
      this.version,
      this.createdAt,
      new Date(),
    );
  }
}
