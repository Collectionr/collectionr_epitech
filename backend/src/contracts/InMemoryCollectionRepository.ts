import { CardEntry } from '../modules/collection/domain/entities/CardEntry';
import type { ValidCardEntryChanges } from '../modules/collection/domain/entities/CardEntry';
import { Collection } from '../modules/collection/domain/entities/Collection';
import type { PageRequest } from '../modules/collection/domain/value-objects/PageRequest';
import {
  CardEntryNotFoundError,
  CardNotFoundError,
  CollectionLimitReachedError,
  CollectionNotFoundError,
  LicenceNotFoundError,
} from '../modules/collection/application/errors/CollectionErrors';
import type { ICollectionRepository } from '../modules/collection/application/ports/ICollectionRepository';
import type { Page } from '../modules/collection/application/ports/Page';

/** The slice of the catalogue (COLLR-684) the collection repository checks against. */
export interface InMemoryCatalogue {
  readonly licences: ReadonlySet<string>;
  /** card id -> the licence it belongs to. */
  readonly cards: ReadonlyMap<string, string>;
  /** variant id -> the card it is a printing of. */
  readonly variants: ReadonlyMap<string, string>;
}

/** Most recent first, ties broken on the id so that pages are stable (same order as the port requires). */
function newestFirst(a: { id: string; at: Date }, b: { id: string; at: Date }): number {
  return b.at.getTime() - a.at.getTime() || (a.id < b.id ? 1 : -1);
}

/**
 * In-memory ICollectionRepository honouring the same contract as the Prisma one (see
 * src/contracts/CollectionPorts.contract.ts). Every operation runs its whole critical section in a
 * single synchronous step, as a transaction would: that is what makes the limit check atomic and
 * keeps a deleted collection from coming back.
 */
export class InMemoryCollectionRepository implements ICollectionRepository {
  private readonly collections = new Map<string, Collection>();
  private readonly entries = new Map<string, CardEntry>();

  constructor(private readonly catalogue: InMemoryCatalogue) {}

  create(collection: Collection, maxPerUser: number): Promise<Collection> {
    return Promise.resolve().then(() => {
      const owned = [...this.collections.values()].filter((c) => c.userId === collection.userId);
      if (owned.length >= maxPerUser) {
        throw new CollectionLimitReachedError();
      }
      if (!this.catalogue.licences.has(collection.licenceTCGId)) {
        throw new LicenceNotFoundError();
      }
      this.collections.set(collection.id, collection);
      return collection;
    });
  }

  findById(id: string): Promise<Collection | null> {
    return Promise.resolve(this.collections.get(id) ?? null);
  }

  findByUserId(userId: string): Promise<readonly Collection[]> {
    return Promise.resolve(
      [...this.collections.values()]
        .filter((c) => c.userId === userId)
        .sort((a, b) => newestFirst({ id: a.id, at: a.createdAt }, { id: b.id, at: b.createdAt })),
    );
  }

  rename(collection: Collection): Promise<Collection> {
    return Promise.resolve().then(() => {
      const stored = this.collections.get(collection.id);
      if (stored === undefined) {
        throw new CollectionNotFoundError();
      }
      // Only the name and updatedAt are written: owner, licence and creation date stay as stored.
      const renamed = Collection.restore({
        id: stored.id,
        userId: stored.userId,
        licenceTCGId: stored.licenceTCGId,
        name: collection.name,
        createdAt: stored.createdAt,
        updatedAt: collection.updatedAt,
      });
      this.collections.set(renamed.id, renamed);
      return renamed;
    });
  }

  delete(id: string): Promise<void> {
    return Promise.resolve().then(() => {
      this.collections.delete(id);
      for (const entry of [...this.entries.values()]) {
        if (entry.collectionId === id) {
          this.entries.delete(entry.id);
        }
      }
    });
  }

  addCardEntry(entry: CardEntry): Promise<CardEntry> {
    return Promise.resolve().then(() => {
      const collection = this.collections.get(entry.collectionId);
      if (collection === undefined) {
        throw new CollectionNotFoundError();
      }
      const cardLicence = this.catalogue.cards.get(entry.cardId);
      if (cardLicence === undefined || cardLicence !== collection.licenceTCGId) {
        throw new CardNotFoundError();
      }
      if (
        entry.variantId !== null &&
        this.catalogue.variants.get(entry.variantId) !== entry.cardId
      ) {
        throw new CardNotFoundError();
      }
      this.entries.set(entry.id, entry);
      return entry;
    });
  }

  updateCardEntry(
    collectionId: string,
    entryId: string,
    changes: ValidCardEntryChanges,
  ): Promise<CardEntry> {
    return Promise.resolve().then(() => {
      const stored = this.entries.get(entryId);
      if (stored === undefined || stored.collectionId !== collectionId) {
        throw new CardEntryNotFoundError();
      }
      // Exactly the given fields change; everything else is carried over from what is stored.
      const updated = CardEntry.restore({
        id: stored.id,
        collectionId: stored.collectionId,
        cardId: stored.cardId,
        variantId: stored.variantId,
        quantity: changes.quantity ?? stored.quantity,
        condition: changes.condition ?? stored.condition,
        language: changes.language ?? stored.language,
        gradingNote: changes.gradingNote === undefined ? stored.gradingNote : changes.gradingNote,
        notes: changes.notes === undefined ? stored.notes : changes.notes,
        addedAt: stored.addedAt,
        updatedAt: new Date(Math.max(Date.now(), stored.updatedAt.getTime() + 1)),
      });
      this.entries.set(updated.id, updated);
      return updated;
    });
  }

  findCardEntries(collectionId: string, page: PageRequest): Promise<Page<CardEntry>> {
    const all = [...this.entries.values()]
      .filter((entry) => entry.collectionId === collectionId)
      .sort((a, b) => newestFirst({ id: a.id, at: a.addedAt }, { id: b.id, at: b.addedAt }));

    return Promise.resolve({
      items: all.slice(page.offset, page.offset + page.pageSize),
      total: all.length,
      page: page.page,
      pageSize: page.pageSize,
    });
  }

  deleteCardEntry(collectionId: string, entryId: string): Promise<void> {
    return Promise.resolve().then(() => {
      const stored = this.entries.get(entryId);
      if (stored === undefined || stored.collectionId !== collectionId) {
        throw new CardEntryNotFoundError();
      }
      this.entries.delete(entryId);
    });
  }
}
