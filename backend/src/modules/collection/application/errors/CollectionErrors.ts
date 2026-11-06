import { MAX_COLLECTIONS_PER_USER } from '../../domain/rules/CollectionLimits';

// Messages are fixed on purpose: an error message ends up in an HTTP response and in logs, and
// must never echo what the caller sent (an id) nor confirm more than the status code does.

/**
 * The collection does not exist OR belongs to someone else. Both look the same to the caller:
 * telling them apart would let anyone probe which collection ids exist (IDOR, S03 §5.3).
 */
export class CollectionNotFoundError extends Error {
  constructor() {
    super('Collection not found');
    this.name = 'CollectionNotFoundError';
  }
}

/** The user already owns the maximum number of collections. The limit is a constant, not user input. */
export class CollectionLimitReachedError extends Error {
  constructor() {
    super(`A user cannot own more than ${MAX_COLLECTIONS_PER_USER} collections`);
    this.name = 'CollectionLimitReachedError';
  }
}

/** The entry does not exist in this collection. */
export class CardEntryNotFoundError extends Error {
  constructor() {
    super('Card entry not found');
    this.name = 'CardEntryNotFoundError';
  }
}

/** The licence given for a new collection is not in the catalogue. Raised by the repository. */
export class LicenceNotFoundError extends Error {
  constructor() {
    super('Licence not found');
    this.name = 'LicenceNotFoundError';
  }
}

/**
 * The card is not in the catalogue, the variant is not a printing of that card, or the card is
 * from another licence than the collection's. Raised by the repository: the domain has no access
 * to the catalogue to check it earlier. One message for all three, so it says nothing more than 404.
 */
export class CardNotFoundError extends Error {
  constructor() {
    super('Card or variant not found for this collection');
    this.name = 'CardNotFoundError';
  }
}
