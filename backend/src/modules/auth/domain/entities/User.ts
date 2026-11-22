import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '../errors/DomainValidationError';
import { Email } from '../value-objects/Email';
import { accountDeletionDueAt } from '../rules/AccountDeletionPolicy';

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 32;

// Control, format (zero-width, bidi overrides) and line/paragraph separators:
// invisible characters let two usernames look identical. A regular space is allowed.
const USERNAME_FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/**
 * What an anonymized account holds instead of its personal data. `.invalid` is reserved (RFC 2606): the
 * address can never belong to anyone, so nothing is ever mailed to it. The hash is not a bcrypt hash,
 * so no password verifies against it.
 */
const ANONYMIZED_EMAIL_DOMAIN = 'anonymized.invalid';
const ANONYMIZED_PASSWORD_HASH = '!';

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
  /** A deactivated account (admin action, CDC §3.5, or erasure request) must not be able to log in. */
  readonly isActive: boolean;
  /**
   * When the user asked for the erasure of their account (RGPD Art. 17), or null. Distinct from an
   * admin deactivation, which blocks an account without erasing it and leaves this null.
   */
  readonly deletedAt: Date | null;
  /** The personal data was replaced (see `anonymize`): the account is gone, only the row remains. */
  readonly isAnonymized: boolean;
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
    public readonly deletedAt: Date | null,
    public readonly isAnonymized: boolean,
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
      null,
      false,
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
      props.deletedAt,
      props.isAnonymized,
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
    return this.copy({ isActive: false });
  }

  /**
   * The user asks for the erasure of their account (RGPD Art. 17): the account is deactivated now and
   * becomes eligible for anonymization once the grace period is over (see `isDeletionDueAt`).
   * Asking again does not restart the clock: the first request stands, so repeating the call cannot
   * be used to keep the data longer than the law allows. Whoever calls this must also revoke the
   * account's sessions (see RequestAccountDeletionUseCase).
   */
  requestDeletion(now: Date = new Date()): User {
    if (this.isAnonymized) {
      throw new Error('An anonymized account cannot request its deletion');
    }
    if (this.deletedAt !== null) {
      return this;
    }
    return this.copy({ isActive: false, deletedAt: now, updatedAt: now });
  }

  /** Whether the grace period that started with the erasure request is over at `now`. */
  isDeletionDueAt(now: Date): boolean {
    return (
      this.deletedAt !== null && !this.isAnonymized && accountDeletionDueAt(this.deletedAt) <= now
    );
  }

  /**
   * Replaces every personal datum of the account (email, username, password hash) with a value derived
   * from the id alone. What stays is what identifies nobody: the id (which the retained audit trail
   * points at), the terms acceptance (proof of the contract) and the dates.
   *
   * Refuses an account whose erasure was never requested, and one still inside its grace period:
   * anonymizing is irreversible, so the deadline is enforced here and not only by whoever schedules it.
   */
  anonymize(now: Date = new Date()): User {
    if (this.deletedAt === null) {
      throw new Error('An account whose deletion was not requested cannot be anonymized');
    }
    if (this.isAnonymized) {
      return this;
    }
    if (!this.isDeletionDueAt(now)) {
      throw new Error('The grace period of this account has not ended yet');
    }
    // Derived from the whole id so that two accounts can never collide. At 40 characters the username is
    // longer than USERNAME_MAX_LENGTH: no rule is broken, assertValidUsername guards what a user types,
    // not what the system writes, and the column is TEXT.
    const handle = this.id.replaceAll('-', '');
    return this.copy({
      email: Email.restore(`deleted-${handle}@${ANONYMIZED_EMAIL_DOMAIN}`),
      username: `deleted-${handle}`,
      passwordHash: ANONYMIZED_PASSWORD_HASH,
      isActive: false,
      isAnonymized: true,
      updatedAt: now,
    });
  }

  withPasswordHash(passwordHash: string): User {
    return this.copy({ passwordHash });
  }

  withUsername(username: string): User {
    User.assertValidUsername(username);

    return this.copy({ username: username.trim() });
  }

  /** A new User with `changes` applied and `updatedAt` refreshed unless the change sets it. */
  private copy(changes: Partial<Omit<UserProps, 'id' | 'version' | 'createdAt'>>): User {
    return new User(
      this.id,
      changes.email ?? this.email,
      changes.passwordHash ?? this.passwordHash,
      changes.username ?? this.username,
      changes.termsAcceptedAt ?? this.termsAcceptedAt,
      changes.termsVersion ?? this.termsVersion,
      changes.isActive ?? this.isActive,
      changes.deletedAt === undefined ? this.deletedAt : changes.deletedAt,
      changes.isAnonymized ?? this.isAnonymized,
      this.version,
      this.createdAt,
      changes.updatedAt ?? new Date(),
    );
  }
}
