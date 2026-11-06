import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../generated/prisma/client.js';
import type {
  CardEntry as PrismaCardEntry,
  Collection as PrismaCollection,
  PrismaClient,
} from '../../../../generated/prisma/client.js';
import {
  CardEntryNotFoundError,
  CardNotFoundError,
  CollectionLimitReachedError,
  CollectionNotFoundError,
  LicenceNotFoundError,
} from '../../application/errors/CollectionErrors';
import { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { PageRequest } from '../../domain/value-objects/PageRequest';
import { ENTRY_CARD_FK, ENTRY_COLLECTION_FK, ENTRY_VARIANT_FK } from './ForeignKeyViolation';
import { PrismaCollectionRepository } from './PrismaCollectionRepository';

// What these tests prove: the repository asks the store for the right thing, in the right order, and
// turns its failures into the typed errors of the port. That the store then really holds the
// guarantees (lock, foreign keys, index) is proven on PostgreSQL by
// src/contracts/CollectionPorts.contract.integration-spec.ts (npm run test:integration).

const USER_ID = randomUUID();
const LICENCE_ID = randomUUID();
const CARD_ID = randomUUID();
const VARIANT_ID = randomUUID();
const NOW = new Date('2026-11-06T10:00:00.000Z');

function storedCollection(overrides: Partial<PrismaCollection> = {}): PrismaCollection {
  return {
    id: randomUUID(),
    userId: USER_ID,
    licenceTCGId: LICENCE_ID,
    name: 'Ma collection',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function storedEntry(overrides: Partial<PrismaCardEntry> = {}): PrismaCardEntry {
  return {
    id: randomUUID(),
    collectionId: randomUUID(),
    cardId: CARD_ID,
    variantId: null,
    gradingResultId: null,
    quantity: 2,
    condition: 'NM',
    language: 'fr',
    gradingNote: null,
    notes: null,
    addedAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

/** The argument of the first call of a mocked Prisma method, typed (jest mocks give back `any`). */
function firstArgument<T>(mock: jest.Mock): T {
  return (mock.mock.calls[0] as [T])[0];
}

function knownError(code: string, constraint?: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('failed', {
    code,
    clientVersion: 'test',
    meta: constraint === undefined ? undefined : { constraint: { index: constraint } },
  });
}

describe('PrismaCollectionRepository', () => {
  const queryRaw = jest.fn();
  const licenceFindUnique = jest.fn();
  const collectionCount = jest.fn();
  const collectionCreate = jest.fn();
  const collectionFindUnique = jest.fn();
  const collectionFindMany = jest.fn();
  const collectionUpdate = jest.fn();
  const collectionDeleteMany = jest.fn();
  const cardFindUnique = jest.fn();
  const variantFindFirst = jest.fn();
  const entryCreate = jest.fn();
  const entryUpdate = jest.fn();
  const entryCount = jest.fn();
  const entryFindMany = jest.fn();
  const entryDeleteMany = jest.fn();
  let repository: PrismaCollectionRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    const client = {
      $queryRaw: queryRaw,
      licenceTCG: { findUnique: licenceFindUnique },
      collection: {
        count: collectionCount,
        create: collectionCreate,
        findUnique: collectionFindUnique,
        findMany: collectionFindMany,
        update: collectionUpdate,
        deleteMany: collectionDeleteMany,
      },
      card: { findUnique: cardFindUnique },
      variant: { findFirst: variantFindFirst },
      cardEntry: {
        create: entryCreate,
        update: entryUpdate,
        count: entryCount,
        findMany: entryFindMany,
        deleteMany: entryDeleteMany,
      },
      // Interactive transactions run their callback against the same fake; batches resolve together.
      $transaction: (work: unknown) =>
        typeof work === 'function'
          ? (work as (tx: unknown) => unknown)(client)
          : Promise.all(work as unknown[]),
    };
    repository = new PrismaCollectionRepository(client as unknown as PrismaClient);
  });

  const newCollection = (): Collection =>
    Collection.create({ userId: USER_ID, licenceTCGId: LICENCE_ID, name: 'Ma collection' });

  describe('create', () => {
    beforeEach(() => {
      queryRaw.mockResolvedValue([{ id: USER_ID }]);
      licenceFindUnique.mockResolvedValue({ id: LICENCE_ID });
      collectionCount.mockResolvedValue(0);
    });

    it('locks the owner, then counts, then inserts the collection', async () => {
      const collection = newCollection();
      collectionCreate.mockResolvedValue(
        storedCollection({ id: collection.id, name: collection.name }),
      );

      const created = await repository.create(collection, 10);

      expect(created.id).toBe(collection.id);
      const order = [
        queryRaw.mock.invocationCallOrder[0],
        collectionCount.mock.invocationCallOrder[0],
        collectionCreate.mock.invocationCallOrder[0],
      ];
      expect(order).toEqual([...order].sort((a, b) => a - b));
      expect(collectionCount).toHaveBeenCalledWith({ where: { userId: USER_ID } });
      expect(firstArgument<{ data: object }>(collectionCreate).data).toMatchObject({
        id: collection.id,
        userId: USER_ID,
        licenceTCGId: LICENCE_ID,
        name: 'Ma collection',
      });
    });

    it('refuses with CollectionLimitReachedError when the owner already has the maximum, inserting nothing', async () => {
      collectionCount.mockResolvedValue(10);

      await expect(repository.create(newCollection(), 10)).rejects.toBeInstanceOf(
        CollectionLimitReachedError,
      );

      expect(collectionCreate).not.toHaveBeenCalled();
    });

    it('accepts the last free place (9 owned, maximum 10)', async () => {
      collectionCount.mockResolvedValue(9);
      collectionCreate.mockResolvedValue(storedCollection());

      await expect(repository.create(newCollection(), 10)).resolves.toBeDefined();
    });

    it('refuses with LicenceNotFoundError for an unknown licence', async () => {
      licenceFindUnique.mockResolvedValue(null);

      await expect(repository.create(newCollection(), 10)).rejects.toBeInstanceOf(
        LicenceNotFoundError,
      );
      expect(collectionCreate).not.toHaveBeenCalled();
    });

    it('turns a licence foreign key violation (licence removed meanwhile) into LicenceNotFoundError', async () => {
      collectionCreate.mockRejectedValue(knownError('P2003', 'collections_licenceTCGId_fkey'));

      await expect(repository.create(newCollection(), 10)).rejects.toBeInstanceOf(
        LicenceNotFoundError,
      );
    });

    it('lets any other failure surface untouched (an unknown owner is not a typed error)', async () => {
      const failure = knownError('P2003', 'collections_userId_fkey');
      collectionCreate.mockRejectedValue(failure);

      await expect(repository.create(newCollection(), 10)).rejects.toBe(failure);
    });
  });

  describe('reads', () => {
    it('finds a collection by id', async () => {
      const record = storedCollection();
      collectionFindUnique.mockResolvedValue(record);

      const found = await repository.findById(record.id);

      expect(found?.id).toBe(record.id);
      expect(found?.userId).toBe(USER_ID);
    });

    it('answers null for an unknown id, and without any query for a malformed one', async () => {
      collectionFindUnique.mockResolvedValue(null);

      await expect(repository.findById(randomUUID())).resolves.toBeNull();
      await expect(repository.findById('not-a-uuid')).resolves.toBeNull();
      expect(collectionFindUnique).toHaveBeenCalledTimes(1);
    });

    it('lists the collections of a user, newest first with the id as tie-break', async () => {
      collectionFindMany.mockResolvedValue([storedCollection(), storedCollection()]);

      const found = await repository.findByUserId(USER_ID);

      expect(found).toHaveLength(2);
      expect(collectionFindMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });
    });

    it('lists nothing, without any query, for a malformed user id', async () => {
      await expect(repository.findByUserId('not-a-uuid')).resolves.toEqual([]);
      expect(collectionFindMany).not.toHaveBeenCalled();
    });
  });

  describe('rename', () => {
    it('writes the name and the update date, and nothing else', async () => {
      const collection = newCollection().rename('Doubles');
      collectionUpdate.mockResolvedValue(
        storedCollection({ id: collection.id, name: 'Doubles', updatedAt: collection.updatedAt }),
      );

      const renamed = await repository.rename(collection);

      expect(renamed.name).toBe('Doubles');
      expect(collectionUpdate).toHaveBeenCalledWith({
        where: { id: collection.id },
        data: { name: 'Doubles', updatedAt: collection.updatedAt },
      });
    });

    it('rejects with CollectionNotFoundError when the collection was deleted meanwhile (never re-creates it)', async () => {
      collectionUpdate.mockRejectedValue(knownError('P2025'));

      await expect(repository.rename(newCollection().rename('Zombie'))).rejects.toBeInstanceOf(
        CollectionNotFoundError,
      );
    });

    it('lets any other failure surface untouched', async () => {
      const failure = new Error('connection lost');
      collectionUpdate.mockRejectedValue(failure);

      await expect(repository.rename(newCollection().rename('X'))).rejects.toBe(failure);
    });
  });

  describe('delete', () => {
    it('deletes with a single statement that does not fail when the collection is already gone', async () => {
      const id = randomUUID();
      collectionDeleteMany.mockResolvedValue({ count: 0 });

      await expect(repository.delete(id)).resolves.toBeUndefined();

      expect(collectionDeleteMany).toHaveBeenCalledWith({ where: { id } });
    });

    it('does nothing, without any query, for a malformed id', async () => {
      await repository.delete('not-a-uuid');

      expect(collectionDeleteMany).not.toHaveBeenCalled();
    });
  });

  describe('addCardEntry', () => {
    const newEntry = (collectionId: string, variantId: string | null = null): CardEntry =>
      CardEntry.create({
        collectionId,
        cardId: CARD_ID,
        variantId,
        quantity: 2,
        condition: 'NM',
        language: 'fr',
        gradingNote: 9.5,
        notes: 'Signed',
      });

    beforeEach(() => {
      queryRaw.mockResolvedValue([{ licenceTCGId: LICENCE_ID }]);
      cardFindUnique.mockResolvedValue({ set: { licenceTCGId: LICENCE_ID } });
      variantFindFirst.mockResolvedValue({ id: VARIANT_ID });
    });

    it('inserts the entry after checking the collection, the card and its licence', async () => {
      const entry = newEntry(randomUUID(), VARIANT_ID);
      entryCreate.mockResolvedValue(
        storedEntry({
          id: entry.id,
          collectionId: entry.collectionId,
          variantId: VARIANT_ID,
          gradingNote: new Prisma.Decimal('9.5'),
          notes: 'Signed',
        }),
      );

      const added = await repository.addCardEntry(entry);

      expect(added).toMatchObject({ id: entry.id, variantId: VARIANT_ID, gradingNote: 9.5 });
      expect(variantFindFirst).toHaveBeenCalledWith({
        where: { id: VARIANT_ID, cardId: CARD_ID },
        select: { id: true },
      });
      expect(firstArgument<{ data: object }>(entryCreate).data).toMatchObject({
        id: entry.id,
        collectionId: entry.collectionId,
        cardId: CARD_ID,
        variantId: VARIANT_ID,
        quantity: 2,
        condition: 'NM',
        language: 'fr',
        gradingNote: 9.5,
        notes: 'Signed',
      });
    });

    it('does not look for a variant when the entry names none', async () => {
      entryCreate.mockResolvedValue(storedEntry());

      await repository.addCardEntry(newEntry(randomUUID()));

      expect(variantFindFirst).not.toHaveBeenCalled();
    });

    it('rejects with CollectionNotFoundError when the collection does not exist (any more)', async () => {
      queryRaw.mockResolvedValue([]);

      await expect(repository.addCardEntry(newEntry(randomUUID()))).rejects.toBeInstanceOf(
        CollectionNotFoundError,
      );
      expect(entryCreate).not.toHaveBeenCalled();
    });

    it('rejects with CardNotFoundError for a card that is not in the catalogue', async () => {
      cardFindUnique.mockResolvedValue(null);

      await expect(repository.addCardEntry(newEntry(randomUUID()))).rejects.toBeInstanceOf(
        CardNotFoundError,
      );
      expect(entryCreate).not.toHaveBeenCalled();
    });

    it('rejects with CardNotFoundError for a card of another licence than the collection’s', async () => {
      cardFindUnique.mockResolvedValue({ set: { licenceTCGId: randomUUID() } });

      await expect(repository.addCardEntry(newEntry(randomUUID()))).rejects.toBeInstanceOf(
        CardNotFoundError,
      );
      expect(entryCreate).not.toHaveBeenCalled();
    });

    it('rejects with CardNotFoundError for a variant that is not a printing of that card', async () => {
      variantFindFirst.mockResolvedValue(null);

      await expect(
        repository.addCardEntry(newEntry(randomUUID(), randomUUID())),
      ).rejects.toBeInstanceOf(CardNotFoundError);
      expect(entryCreate).not.toHaveBeenCalled();
    });

    it.each([
      ['the collection', ENTRY_COLLECTION_FK, CollectionNotFoundError],
      ['the card', ENTRY_CARD_FK, CardNotFoundError],
      ['the variant', ENTRY_VARIANT_FK, CardNotFoundError],
    ])(
      'turns a foreign key violation on %s (row removed after the checks) into its typed error',
      async (_label, constraint, expected) => {
        entryCreate.mockRejectedValue(knownError('P2003', constraint));

        await expect(repository.addCardEntry(newEntry(randomUUID()))).rejects.toBeInstanceOf(
          expected,
        );
      },
    );

    it('lets any other failure surface untouched', async () => {
      const failure = new Error('connection lost');
      entryCreate.mockRejectedValue(failure);

      await expect(repository.addCardEntry(newEntry(randomUUID()))).rejects.toBe(failure);
    });
  });

  describe('updateCardEntry', () => {
    const collectionId = randomUUID();
    const entryId = randomUUID();

    it('writes exactly the given fields, scoped by the collection, and stamps the update date', async () => {
      entryUpdate.mockResolvedValue(storedEntry({ id: entryId, collectionId, quantity: 7 }));

      const updated = await repository.updateCardEntry(
        collectionId,
        entryId,
        CardEntry.validateChanges({ quantity: 7 }),
      );

      expect(updated.quantity).toBe(7);
      const call = firstArgument<{ where: object; data: { updatedAt: Date } }>(entryUpdate);
      expect(call.where).toEqual({ id: entryId, collectionId });
      expect(call.data).toEqual({ quantity: 7, updatedAt: call.data.updatedAt });
      expect(call.data.updatedAt).toBeInstanceOf(Date);
    });

    it('writes every field it is given, and clears the nullable ones with null', async () => {
      entryUpdate.mockResolvedValue(storedEntry());

      await repository.updateCardEntry(
        collectionId,
        entryId,
        CardEntry.validateChanges({
          quantity: 3,
          condition: 'LP',
          language: 'en',
          gradingNote: null,
          notes: null,
        }),
      );

      const call = firstArgument<{ where: object; data: { updatedAt: Date } }>(entryUpdate);
      expect(call.where).toEqual({ id: entryId, collectionId });
      expect(call.data).toEqual({
        quantity: 3,
        condition: 'LP',
        language: 'en',
        gradingNote: null,
        notes: null,
        updatedAt: call.data.updatedAt,
      });
    });

    it('never writes gradingResultId, nor the card or the printing', async () => {
      entryUpdate.mockResolvedValue(storedEntry());

      await repository.updateCardEntry(
        collectionId,
        entryId,
        CardEntry.validateChanges({ notes: 'x', gradingNote: 8 }),
      );

      const { data } = firstArgument<{ data: Record<string, unknown> }>(entryUpdate);
      expect(Object.keys(data).sort()).toEqual(['gradingNote', 'notes', 'updatedAt']);
    });

    it('rejects with CardEntryNotFoundError when the entry is not in that collection (or was deleted)', async () => {
      entryUpdate.mockRejectedValue(knownError('P2025'));

      await expect(
        repository.updateCardEntry(
          collectionId,
          entryId,
          CardEntry.validateChanges({ quantity: 2 }),
        ),
      ).rejects.toBeInstanceOf(CardEntryNotFoundError);
    });

    it('rejects with CardEntryNotFoundError, without any query, for a malformed id', async () => {
      const changes = CardEntry.validateChanges({ quantity: 2 });

      await expect(
        repository.updateCardEntry('not-a-uuid', entryId, changes),
      ).rejects.toBeInstanceOf(CardEntryNotFoundError);
      await expect(
        repository.updateCardEntry(collectionId, 'not-a-uuid', changes),
      ).rejects.toBeInstanceOf(CardEntryNotFoundError);
      expect(entryUpdate).not.toHaveBeenCalled();
    });

    it('lets any other failure surface untouched', async () => {
      const failure = new Error('connection lost');
      entryUpdate.mockRejectedValue(failure);

      await expect(
        repository.updateCardEntry(
          collectionId,
          entryId,
          CardEntry.validateChanges({ quantity: 2 }),
        ),
      ).rejects.toBe(failure);
    });
  });

  describe('findCardEntries', () => {
    const collectionId = randomUUID();

    it('reads one page, newest first with the id as tie-break, and counts the whole collection', async () => {
      entryCount.mockResolvedValue(137);
      entryFindMany.mockResolvedValue([
        storedEntry({ collectionId }),
        storedEntry({ collectionId, gradingNote: new Prisma.Decimal('8.5') }),
      ]);

      const page = await repository.findCardEntries(
        collectionId,
        PageRequest.create({ page: 3, pageSize: 20 }),
      );

      expect(page).toMatchObject({ total: 137, page: 3, pageSize: 20 });
      expect(page.items).toHaveLength(2);
      expect(page.items[1].gradingNote).toBe(8.5);
      expect(entryCount).toHaveBeenCalledWith({ where: { collectionId } });
      expect(entryFindMany).toHaveBeenCalledWith({
        where: { collectionId },
        orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
        skip: 40,
        take: 20,
      });
    });

    it('answers an empty page, without any query, for a malformed collection id', async () => {
      const page = await repository.findCardEntries('not-a-uuid', PageRequest.create());

      expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
      expect(entryFindMany).not.toHaveBeenCalled();
    });
  });

  describe('deleteCardEntry', () => {
    const collectionId = randomUUID();
    const entryId = randomUUID();

    it('deletes the entry of that collection', async () => {
      entryDeleteMany.mockResolvedValue({ count: 1 });

      await expect(repository.deleteCardEntry(collectionId, entryId)).resolves.toBeUndefined();

      expect(entryDeleteMany).toHaveBeenCalledWith({ where: { id: entryId, collectionId } });
    });

    it('rejects with CardEntryNotFoundError when nothing was deleted', async () => {
      entryDeleteMany.mockResolvedValue({ count: 0 });

      await expect(repository.deleteCardEntry(collectionId, entryId)).rejects.toBeInstanceOf(
        CardEntryNotFoundError,
      );
    });

    it('rejects with CardEntryNotFoundError, without any query, for a malformed id', async () => {
      await expect(repository.deleteCardEntry('not-a-uuid', entryId)).rejects.toBeInstanceOf(
        CardEntryNotFoundError,
      );
      await expect(repository.deleteCardEntry(collectionId, 'not-a-uuid')).rejects.toBeInstanceOf(
        CardEntryNotFoundError,
      );
      expect(entryDeleteMany).not.toHaveBeenCalled();
    });
  });
});
