import type { CardEntry, ValidCardEntryChanges } from '../../domain/entities/CardEntry';
import type { Collection } from '../../domain/entities/Collection';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import type { Page } from './Page';

export const COLLECTION_REPOSITORY = 'COLLECTION_REPOSITORY';

/**
 * Persistence of collections and of their card entries. One port for both: an entry only makes
 * sense inside its collection, and every entry operation is scoped by `collectionId` so that an
 * entry can never be reached through a collection it does not belong to.
 *
 * The use cases check ownership; this port does not know about authenticated users. Every id passed
 * in has already been validated as a UUID by the domain; reads still answer null / an empty page
 * for an id that matches nothing, and never throw on one.
 *
 * Each write below states what it MUST reject or guarantee. These are guarantees of the store
 * (foreign keys, unique and composite constraints, one transaction), not read-then-write checks in
 * application code, which two concurrent requests would both pass. The behavioural contract
 * (src/contracts/CollectionPorts.contract.ts) checks them against every implementation.
 */
export interface ICollectionRepository {
  /**
   * Inserts a new collection, atomically with the limit check: under a lock on the owner it counts
   * the owner's collections and inserts only if they own fewer than `maxPerUser`, so concurrent
   * creations cannot exceed it.
   *
   * MUST reject with CollectionLimitReachedError (application/errors/CollectionErrors.ts) when the
   * owner already has `maxPerUser` collections, and with LicenceNotFoundError when `licenceTCGId`
   * is not in the catalogue (foreign key). When both apply, which of the two is reported is
   * unspecified. `maxPerUser` is a positive integer (the use case passes a constant).
   *
   * An owner that does not exist (for example an account erased at the same moment) is not
   * expected: the owner is the authenticated user taken from the session. An implementation lets
   * that case surface as an unexpected error (5xx) instead of inventing a typed one.
   */
  create(collection: Collection, maxPerUser: number): Promise<Collection>;
  /** Null when no collection has this id. */
  findById(id: string): Promise<Collection | null>;
  /** All the user's collections, most recently created first. At most MAX_COLLECTIONS_PER_USER. */
  findByUserId(userId: string): Promise<readonly Collection[]>;
  /**
   * Writes the name and `updatedAt` of an EXISTING collection and nothing else. MUST reject with
   * CollectionNotFoundError when it no longer exists (deleted by a concurrent request): it never
   * re-creates it, which would bring back an empty collection whose entries are gone.
   */
  rename(collection: Collection): Promise<Collection>;
  /**
   * Deletes the collection AND all its card entries, atomically: either both are gone or neither.
   * Does nothing when the collection does not exist. A repeated request still gets a "not found"
   * from DeleteCollectionUseCase, which looks the collection up first; this leniency only covers
   * two deletions racing each other, so that the loser does not fail with an unexpected error.
   */
  delete(id: string): Promise<void>;

  /**
   * Inserts a new entry. Never updates and never merges with an identical one.
   *
   * MUST reject with CardNotFoundError when `cardId` is not in the catalogue, when `variantId` is
   * not a printing of THAT card, or when the card does not belong to the collection's licence.
   * A foreign key on `variantId` alone only proves that the variant exists: "belongs to this card"
   * needs a composite foreign key (cardId, variantId) -> variants(cardId, id) or an explicit check
   * in the same transaction. MUST reject with CollectionNotFoundError when the collection no longer
   * exists (deleted by a concurrent request).
   */
  addCardEntry(entry: CardEntry): Promise<CardEntry>;
  /**
   * Writes exactly the given fields of an EXISTING entry of that collection, sets `updatedAt`, and
   * returns the entry as stored. Every other column is left untouched: two concurrent edits of
   * different fields do not undo each other, and columns the domain does not model (such as
   * `gradingResultId`) survive.
   *
   * MUST reject with CardEntryNotFoundError when the entry does not exist in that collection (it
   * never inserts, so an entry deleted in the meantime does not come back). `changes` always holds
   * at least one field (CardEntry.validateChanges guarantees it; its type cannot be built any
   * other way), so an implementation never has to handle an empty update.
   */
  updateCardEntry(
    collectionId: string,
    entryId: string,
    changes: ValidCardEntryChanges,
  ): Promise<CardEntry>;
  /**
   * A collection's entries, most recently added first, ties broken on the id so pages are stable.
   * Must stay fast on 10 000 entries (CDC §3.1.3): index on the collection, never load them all.
   * An empty page when the collection does not exist.
   */
  findCardEntries(collectionId: string, page: PageRequest): Promise<Page<CardEntry>>;
  /** MUST reject with CardEntryNotFoundError when the entry does not exist in that collection. */
  deleteCardEntry(collectionId: string, entryId: string): Promise<void>;
}
