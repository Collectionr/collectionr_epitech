import { randomUUID } from 'node:crypto';
import { UpdateCardEntryUseCase } from './UpdateCardEntryUseCase';
import { CardEntry } from '../../domain/entities/CardEntry';
import type { ValidCardEntryChanges } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CardEntryNotFoundError, CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();
const ENTRY_ID = randomUUID();

function buildCollection(userId = USER_ID): Collection {
  return Collection.create({ userId, licenceTCGId: randomUUID(), name: 'Ma collection' });
}

describe('UpdateCardEntryUseCase', () => {
  const findById = jest.fn();
  const updateCardEntry = jest.fn<Promise<CardEntry>, [string, string, ValidCardEntryChanges]>();
  let collection: Collection;
  let stored: CardEntry;

  function build(): UpdateCardEntryUseCase {
    return new UpdateCardEntryUseCase({
      findById,
      updateCardEntry,
    } as unknown as ICollectionRepository);
  }

  const baseInput = () => ({ userId: USER_ID, collectionId: collection.id, entryId: ENTRY_ID });

  beforeEach(() => {
    jest.resetAllMocks();
    collection = buildCollection();
    stored = CardEntry.create({
      collectionId: collection.id,
      cardId: randomUUID(),
      quantity: 2,
      condition: 'NM',
      language: 'fr',
    });
    findById.mockResolvedValue(collection);
    updateCardEntry.mockResolvedValue(stored);
  });

  it('sends the repository the validated fields only, scoped to the verified collection', async () => {
    await expect(
      build().execute({
        ...baseInput(),
        changes: { quantity: 5, condition: 'LP', notes: '  resleeved ' },
      }),
    ).resolves.toBe(stored);

    expect(updateCardEntry).toHaveBeenCalledWith(collection.id, ENTRY_ID, {
      quantity: 5,
      condition: 'LP',
      notes: 'resleeved',
    });
  });

  it('never reads the entry first: no read-modify-write that a concurrent edit could undo', async () => {
    await build().execute({ ...baseInput(), changes: { quantity: 5 } });

    expect(updateCardEntry.mock.calls[0][2]).toEqual({ quantity: 5 });
  });

  it.each([
    ['invalid changes', { changes: { quantity: 0 } }],
    ['empty changes', { changes: {} }],
    ['a malformed entry id', { entryId: 'entry-1', changes: { quantity: 5 } }],
  ])(
    'rejects %s as a validation error, without reading or writing anything',
    async (_label, override) => {
      await expect(build().execute({ ...baseInput(), ...override })).rejects.toThrow(
        DomainValidationError,
      );
      expect(findById).not.toHaveBeenCalled();
      expect(updateCardEntry).not.toHaveBeenCalled();
    },
  );

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ ...baseInput(), changes: { quantity: 5 } })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(updateCardEntry).not.toHaveBeenCalled();
  });

  it("refuses to update an entry of another user's collection", async () => {
    findById.mockResolvedValue(buildCollection(randomUUID()));

    await expect(build().execute({ ...baseInput(), changes: { quantity: 5 } })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(updateCardEntry).not.toHaveBeenCalled();
  });

  it('propagates CardEntryNotFoundError thrown by the repository (unknown or deleted entry)', async () => {
    updateCardEntry.mockRejectedValue(new CardEntryNotFoundError());

    await expect(build().execute({ ...baseInput(), changes: { quantity: 5 } })).rejects.toThrow(
      CardEntryNotFoundError,
    );
  });
});
