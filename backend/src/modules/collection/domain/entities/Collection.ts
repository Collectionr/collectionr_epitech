import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '../errors/DomainValidationError';
import { COLLECTION_NAME_MAX_LENGTH, COLLECTION_NAME_MIN_LENGTH } from '../rules/CollectionLimits';

// Control, format (zero-width, bidi overrides) and line/paragraph separators: invisible characters
// let two names look identical. A regular space is allowed.
const NAME_FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export interface NewCollectionProps {
  readonly userId: string;
  /** The TCG licence the collection is about (e.g. Pokémon). Fixed at creation. */
  readonly licenceTCGId: string;
  readonly name: string;
}

export interface CollectionProps extends NewCollectionProps {
  readonly id: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A named set of cards owned by one user, about one licence. It does not hold its card entries:
 * a collection can reach 10 000 of them (CDC §3.1.3), so they are loaded page by page through the
 * repository instead of living inside this object.
 */
export class Collection {
  private constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly licenceTCGId: string,
    public readonly name: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Exposed so callers can reject a bad name before touching the store. */
  static assertValidName(name: string): void {
    const trimmed = name.trim();
    if (
      trimmed.length < COLLECTION_NAME_MIN_LENGTH ||
      trimmed.length > COLLECTION_NAME_MAX_LENGTH
    ) {
      throw new DomainValidationError(
        `Collection name must be between ${COLLECTION_NAME_MIN_LENGTH} and ${COLLECTION_NAME_MAX_LENGTH} characters long`,
      );
    }
    if (NAME_FORBIDDEN_CHARACTERS.test(trimmed)) {
      throw new DomainValidationError(
        'Collection name must not contain control or invisible characters',
      );
    }
  }

  static create(props: NewCollectionProps): Collection {
    Collection.assertValidName(props.name);
    // Not a user mistake: the interface layer takes both ids from the authenticated session and
    // from a validated request, so a blank one is a bug that must not be stored.
    if (props.userId.trim() === '' || props.licenceTCGId.trim() === '') {
      throw new Error('A collection cannot be created without an owner and a licence');
    }
    const now = new Date();

    return new Collection(
      randomUUID(),
      props.userId,
      props.licenceTCGId,
      props.name.trim(),
      now,
      now,
    );
  }

  /**
   * Rebuilds a Collection from data already persisted (used by repository implementations).
   * Deliberately does not re-validate: stored data was valid under the rules of its time, and
   * tightening a rule later must not make existing collections impossible to load.
   */
  static restore(props: CollectionProps): Collection {
    return new Collection(
      props.id,
      props.userId,
      props.licenceTCGId,
      props.name.trim(),
      props.createdAt,
      props.updatedAt,
    );
  }

  isOwnedBy(userId: string): boolean {
    return this.userId === userId;
  }

  rename(name: string): Collection {
    Collection.assertValidName(name);

    return new Collection(
      this.id,
      this.userId,
      this.licenceTCGId,
      name.trim(),
      this.createdAt,
      new Date(),
    );
  }
}
