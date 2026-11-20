/**
 * Reusable behavioural contract for the collection port (COLLR-416).
 * A pure function: it registers jest `describe`/`it` blocks against ANY implementation of
 * ICollectionRepository (the in-memory one today, the Prisma one in COLLR-417). Imports are
 * relative to src/ (the file lives in src/contracts/).
 */
import { randomUUID } from 'node:crypto';
import { CardEntry } from '../modules/collection/domain/entities/CardEntry';
import { Collection } from '../modules/collection/domain/entities/Collection';
import { PageRequest } from '../modules/collection/domain/value-objects/PageRequest';
import {
  CardEntryNotFoundError,
  CardNotFoundError,
  CollectionLimitReachedError,
  CollectionNameAlreadyUsedError,
  CollectionNotFoundError,
  LicenceNotFoundError,
} from '../modules/collection/application/errors/CollectionErrors';
import type { ICollectionRepository } from '../modules/collection/application/ports/ICollectionRepository';

/** What the contract needs from the catalogue the repository under test is wired to. */
export interface CollectionContractHarness {
  readonly repository: ICollectionRepository;
  readonly catalogue: {
    readonly licenceId: string;
    readonly otherLicenceId: string;
    /** A card of `licenceId`, and a printing of it. */
    readonly cardId: string;
    readonly variantId: string;
    /** Another card of `licenceId`, and a printing of THAT card (not of `cardId`). */
    readonly secondCardId: string;
    readonly secondCardVariantId: string;
    /** A card of `otherLicenceId`. */
    readonly foreignCardId: string;
  };
  /** An owner the store accepts (a real user row for implementations with a foreign key). */
  newOwnerId(): Promise<string>;
}

const MAX = 3;

export function collectionRepositoryContract(
  name: string,
  make: () => Promise<CollectionContractHarness> | CollectionContractHarness,
): void {
  describe(`ICollectionRepository contract - ${name}`, () => {
    async function newCollection(
      harness: CollectionContractHarness,
      ownerId?: string,
      label = 'Ma collection',
    ): Promise<Collection> {
      const owner = ownerId ?? (await harness.newOwnerId());
      return harness.repository.create(
        Collection.create({
          userId: owner,
          licenceTCGId: harness.catalogue.licenceId,
          name: label,
        }),
        10,
      );
    }

    const newEntry = (harness: CollectionContractHarness, collection: Collection) =>
      CardEntry.create({
        collectionId: collection.id,
        cardId: harness.catalogue.cardId,
        quantity: 2,
        condition: 'NM',
        language: 'fr',
      });

    describe('collections', () => {
      it("round-trips a created collection by id, and lists the owner's collections only, newest first", async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();
        const first = await newCollection(harness, owner, 'First');
        const second = await newCollection(harness, owner, 'Second');
        await newCollection(harness, undefined, 'Someone else');

        expect((await harness.repository.findById(first.id))?.name).toBe('First');
        const listed = await harness.repository.findByUserId(owner);
        expect(listed.map((c) => c.id).sort()).toEqual([first.id, second.id].sort());
        expect(listed[0].createdAt.getTime()).toBeGreaterThanOrEqual(listed[1].createdAt.getTime());
      });

      it('returns null (never throws) for an unknown or malformed id', async () => {
        const { repository } = await make();
        await expect(repository.findById(randomUUID())).resolves.toBeNull();
        await expect(repository.findById('not-a-uuid')).resolves.toBeNull();
      });

      it('refuses a collection beyond the limit with CollectionLimitReachedError, per owner', async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();
        for (let i = 0; i < MAX; i += 1) {
          await harness.repository.create(
            Collection.create({
              userId: owner,
              licenceTCGId: harness.catalogue.licenceId,
              name: `C${i}`,
            }),
            MAX,
          );
        }

        await expect(
          harness.repository.create(
            Collection.create({
              userId: owner,
              licenceTCGId: harness.catalogue.licenceId,
              name: 'Over',
            }),
            MAX,
          ),
        ).rejects.toBeInstanceOf(CollectionLimitReachedError);
        await expect(newCollection(harness)).resolves.toBeDefined();
      });

      it('under 15 concurrent creations with a limit of 10: exactly 10 win, all others hit the limit', async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();
        const results = await Promise.allSettled(
          Array.from({ length: 15 }, (_, i) =>
            harness.repository.create(
              Collection.create({
                userId: owner,
                licenceTCGId: harness.catalogue.licenceId,
                name: `R${i}`,
              }),
              10,
            ),
          ),
        );

        const wins = results.filter((r) => r.status === 'fulfilled').length;
        const unexpected = results.filter(
          (r) => r.status === 'rejected' && !(r.reason instanceof CollectionLimitReachedError),
        );
        expect(wins).toBe(10);
        expect(unexpected).toHaveLength(0);
        expect(await harness.repository.findByUserId(owner)).toHaveLength(10);
      });

      it('refuses a second collection with the same name for the same owner, but lets another owner use it', async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();
        await newCollection(harness, owner, 'Doubles');

        await expect(newCollection(harness, owner, 'Doubles')).rejects.toBeInstanceOf(
          CollectionNameAlreadyUsedError,
        );
        await expect(newCollection(harness, owner, 'doubles')).resolves.toBeDefined();
        await expect(newCollection(harness, undefined, 'Doubles')).resolves.toBeDefined();
        expect(await harness.repository.findByUserId(owner)).toHaveLength(2);
      });

      it('lets an owner reuse the name of a collection they deleted', async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();
        const first = await newCollection(harness, owner, 'Doubles');
        await harness.repository.delete(first.id);

        await expect(newCollection(harness, owner, 'Doubles')).resolves.toBeDefined();
      });

      it('under concurrent creations of the same name: exactly one wins, all others get CollectionNameAlreadyUsedError', async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();

        const results = await Promise.allSettled(
          Array.from({ length: 5 }, () => newCollection(harness, owner, 'Race')),
        );

        const unexpected = results.filter(
          (r) => r.status === 'rejected' && !(r.reason instanceof CollectionNameAlreadyUsedError),
        );
        expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
        expect(unexpected).toHaveLength(0);
        expect(await harness.repository.findByUserId(owner)).toHaveLength(1);
      });

      it('rejects an unknown licence with LicenceNotFoundError', async () => {
        const harness = await make();
        await expect(
          harness.repository.create(
            Collection.create({
              userId: await harness.newOwnerId(),
              licenceTCGId: randomUUID(),
              name: 'Nope',
            }),
            10,
          ),
        ).rejects.toBeInstanceOf(LicenceNotFoundError);
      });

      it('renames only the name: owner, licence and creation date are kept', async () => {
        const harness = await make();
        const created = await newCollection(harness);

        const renamed = await harness.repository.rename(created.rename('Doubles'));

        expect(renamed.name).toBe('Doubles');
        const stored = await harness.repository.findById(created.id);
        expect(stored?.name).toBe('Doubles');
        expect(stored?.userId).toBe(created.userId);
        expect(stored?.licenceTCGId).toBe(created.licenceTCGId);
        expect(stored?.createdAt.getTime()).toBe(created.createdAt.getTime());
      });

      it('refuses to rename onto another collection of the same owner (CollectionNameAlreadyUsedError), but keeping its own name is fine', async () => {
        const harness = await make();
        const owner = await harness.newOwnerId();
        const doubles = await newCollection(harness, owner, 'Doubles');
        const wishlist = await newCollection(harness, owner, 'Wishlist');

        await expect(harness.repository.rename(wishlist.rename('Doubles'))).rejects.toBeInstanceOf(
          CollectionNameAlreadyUsedError,
        );
        expect((await harness.repository.findById(wishlist.id))?.name).toBe('Wishlist');
        await expect(harness.repository.rename(doubles.rename('Doubles'))).resolves.toBeDefined();
        // Another owner's collection is not in the way.
        const other = await newCollection(harness, undefined, 'Free');
        await expect(harness.repository.rename(other.rename('Doubles'))).resolves.toBeDefined();
      });

      it('never brings a deleted collection back by renaming it (CollectionNotFoundError)', async () => {
        const harness = await make();
        const created = await newCollection(harness);
        await harness.repository.delete(created.id);

        await expect(harness.repository.rename(created.rename('Zombie'))).rejects.toBeInstanceOf(
          CollectionNotFoundError,
        );
        await expect(harness.repository.findById(created.id)).resolves.toBeNull();
      });

      it('deletes the collection together with its entries, and does nothing for a missing one', async () => {
        const harness = await make();
        const created = await newCollection(harness);
        await harness.repository.addCardEntry(newEntry(harness, created));

        await harness.repository.delete(created.id);

        await expect(harness.repository.findById(created.id)).resolves.toBeNull();
        const page = await harness.repository.findCardEntries(created.id, PageRequest.create());
        expect(page.total).toBe(0);
        await expect(harness.repository.delete(randomUUID())).resolves.toBeUndefined();
      });
    });

    describe('card entries', () => {
      it('round-trips an added entry with all its fields', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = CardEntry.create({
          collectionId: collection.id,
          cardId: harness.catalogue.cardId,
          variantId: harness.catalogue.variantId,
          quantity: 3,
          condition: 'LP',
          language: 'en',
          gradingNote: 8.5,
          notes: 'Signed',
        });

        await harness.repository.addCardEntry(entry);

        const page = await harness.repository.findCardEntries(collection.id, PageRequest.create());
        expect(page.total).toBe(1);
        expect(page.items[0]).toMatchObject({
          id: entry.id,
          cardId: harness.catalogue.cardId,
          variantId: harness.catalogue.variantId,
          quantity: 3,
          condition: 'LP',
          language: 'en',
          gradingNote: 8.5,
          notes: 'Signed',
        });
      });

      it('does not merge identical entries', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        await harness.repository.addCardEntry(newEntry(harness, collection));
        await harness.repository.addCardEntry(newEntry(harness, collection));

        const page = await harness.repository.findCardEntries(collection.id, PageRequest.create());
        expect(page.total).toBe(2);
      });

      it.each([
        ['an unknown card', () => ({ cardId: randomUUID() })],
        [
          'a card of another licence',
          (h: CollectionContractHarness) => ({ cardId: h.catalogue.foreignCardId }),
        ],
        [
          'a variant of another card',
          (h: CollectionContractHarness) => ({ variantId: h.catalogue.secondCardVariantId }),
        ],
        ['an unknown variant', () => ({ variantId: randomUUID() })],
      ])('rejects %s with CardNotFoundError', async (_label, override) => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = CardEntry.create({
          collectionId: collection.id,
          cardId: harness.catalogue.cardId,
          quantity: 1,
          condition: 'NM',
          language: 'fr',
          ...override(harness),
        });

        await expect(harness.repository.addCardEntry(entry)).rejects.toBeInstanceOf(
          CardNotFoundError,
        );
      });

      it('rejects an entry for a collection that no longer exists with CollectionNotFoundError', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = newEntry(harness, collection);
        await harness.repository.delete(collection.id);

        await expect(harness.repository.addCardEntry(entry)).rejects.toBeInstanceOf(
          CollectionNotFoundError,
        );
      });

      it('writes only the given fields and keeps the others', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = CardEntry.create({
          collectionId: collection.id,
          cardId: harness.catalogue.cardId,
          quantity: 2,
          condition: 'NM',
          language: 'fr',
          notes: 'Keep me',
        });
        await harness.repository.addCardEntry(entry);

        const updated = await harness.repository.updateCardEntry(
          collection.id,
          entry.id,
          CardEntry.validateChanges({ quantity: 5 }),
        );

        expect(updated.quantity).toBe(5);
        expect(updated.notes).toBe('Keep me');
        expect(updated.condition).toBe('NM');
        expect(updated.cardId).toBe(entry.cardId);
        expect(updated.addedAt.getTime()).toBe(entry.addedAt.getTime());
        // Not strictly greater: a real store can stamp both writes within the same millisecond.
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(entry.updatedAt.getTime());
      });

      it('clears a nullable field with null', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = CardEntry.create({
          collectionId: collection.id,
          cardId: harness.catalogue.cardId,
          quantity: 1,
          condition: 'NM',
          language: 'fr',
          gradingNote: 9,
          notes: 'x',
        });
        await harness.repository.addCardEntry(entry);

        const updated = await harness.repository.updateCardEntry(
          collection.id,
          entry.id,
          CardEntry.validateChanges({ gradingNote: null, notes: null }),
        );

        expect(updated.gradingNote).toBeNull();
        expect(updated.notes).toBeNull();
      });

      it('lets two concurrent edits of different fields both land (no lost update)', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = newEntry(harness, collection);
        await harness.repository.addCardEntry(entry);

        await Promise.all([
          harness.repository.updateCardEntry(
            collection.id,
            entry.id,
            CardEntry.validateChanges({ quantity: 7 }),
          ),
          harness.repository.updateCardEntry(
            collection.id,
            entry.id,
            CardEntry.validateChanges({ notes: 'B' }),
          ),
        ]);

        const page = await harness.repository.findCardEntries(collection.id, PageRequest.create());
        expect(page.items[0]).toMatchObject({ quantity: 7, notes: 'B' });
      });

      it('rejects updating an unknown entry, or one of another collection, with CardEntryNotFoundError', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const other = await newCollection(harness);
        const entry = newEntry(harness, collection);
        await harness.repository.addCardEntry(entry);
        const changes = CardEntry.validateChanges({ quantity: 4 });

        await expect(
          harness.repository.updateCardEntry(collection.id, randomUUID(), changes),
        ).rejects.toBeInstanceOf(CardEntryNotFoundError);
        await expect(
          harness.repository.updateCardEntry(other.id, entry.id, changes),
        ).rejects.toBeInstanceOf(CardEntryNotFoundError);
      });

      it('never brings a deleted entry back by updating it', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const entry = newEntry(harness, collection);
        await harness.repository.addCardEntry(entry);
        await harness.repository.deleteCardEntry(collection.id, entry.id);

        await expect(
          harness.repository.updateCardEntry(
            collection.id,
            entry.id,
            CardEntry.validateChanges({ quantity: 9 }),
          ),
        ).rejects.toBeInstanceOf(CardEntryNotFoundError);
        const page = await harness.repository.findCardEntries(collection.id, PageRequest.create());
        expect(page.total).toBe(0);
      });

      it('deletes an entry, and rejects a missing one or one of another collection with CardEntryNotFoundError', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const other = await newCollection(harness);
        const entry = newEntry(harness, collection);
        await harness.repository.addCardEntry(entry);

        await expect(harness.repository.deleteCardEntry(other.id, entry.id)).rejects.toBeInstanceOf(
          CardEntryNotFoundError,
        );
        await harness.repository.deleteCardEntry(collection.id, entry.id);
        await expect(
          harness.repository.deleteCardEntry(collection.id, entry.id),
        ).rejects.toBeInstanceOf(CardEntryNotFoundError);
      });

      it('paginates: stable pages without overlap that cover every entry, newest first', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        for (let i = 0; i < 5; i += 1) {
          await harness.repository.addCardEntry(newEntry(harness, collection));
        }

        const pages = await Promise.all(
          [1, 2, 3].map((page) =>
            harness.repository.findCardEntries(
              collection.id,
              PageRequest.create({ page, pageSize: 2 }),
            ),
          ),
        );

        expect(pages.map((p) => p.items.length)).toEqual([2, 2, 1]);
        expect(pages.every((p) => p.total === 5 && p.pageSize === 2)).toBe(true);
        const ids = pages.flatMap((p) => p.items.map((e) => e.id));
        expect(new Set(ids).size).toBe(5);
        const times = pages.flatMap((p) => p.items.map((e) => e.addedAt.getTime()));
        expect(times).toEqual([...times].sort((a, b) => b - a));
      });

      it('breaks ties on the id, largest first, so pages stay stable when entries share an instant', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        const sameInstant = new Date();
        const ids: string[] = [];
        for (let i = 0; i < 5; i += 1) {
          const entry = CardEntry.restore({
            id: randomUUID(),
            collectionId: collection.id,
            cardId: harness.catalogue.cardId,
            variantId: null,
            quantity: 1,
            condition: 'NM',
            language: 'fr',
            gradingNote: null,
            notes: null,
            addedAt: sameInstant,
            updatedAt: sameInstant,
          });
          await harness.repository.addCardEntry(entry);
          ids.push(entry.id);
        }

        const pages = await Promise.all(
          [1, 2, 3].map((page) =>
            harness.repository.findCardEntries(
              collection.id,
              PageRequest.create({ page, pageSize: 2 }),
            ),
          ),
        );

        expect(pages.flatMap((p) => p.items.map((e) => e.id))).toEqual([...ids].sort().reverse());
      });

      it('returns an empty page past the end, and for an unknown collection', async () => {
        const harness = await make();
        const collection = await newCollection(harness);
        await harness.repository.addCardEntry(newEntry(harness, collection));

        const past = await harness.repository.findCardEntries(
          collection.id,
          PageRequest.create({ page: 9, pageSize: 10 }),
        );
        const unknown = await harness.repository.findCardEntries(
          randomUUID(),
          PageRequest.create(),
        );

        expect(past.items).toHaveLength(0);
        expect(past.total).toBe(1);
        expect(unknown.items).toHaveLength(0);
        expect(unknown.total).toBe(0);
      });
    });
  });
}
