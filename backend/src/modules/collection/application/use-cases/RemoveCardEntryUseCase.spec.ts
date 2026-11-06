import { randomUUID } from 'node:crypto';
import { RemoveCardEntryUseCase } from './RemoveCardEntryUseCase';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CardEntryNotFoundError, CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();
const ENTRY_ID = randomUUID();

function buildCollection(userId = USER_ID): Collection {
  return Collection.create({ userId, licenceTCGId: randomUUID(), name: 'Ma collection' });
}

describe('RemoveCardEntryUseCase', () => {
  const findById = jest.fn();
  const deleteCardEntry = jest.fn<Promise<void>, [string, string]>();
  let collection: Collection;

  function build(): RemoveCardEntryUseCase {
    return new RemoveCardEntryUseCase({
      findById,
      deleteCardEntry,
    } as unknown as ICollectionRepository);
  }

  const input = () => ({ userId: USER_ID, collectionId: collection.id, entryId: ENTRY_ID });

  beforeEach(() => {
    jest.resetAllMocks();
    collection = buildCollection();
    findById.mockResolvedValue(collection);
    deleteCardEntry.mockResolvedValue(undefined);
  });

  it('removes the entry from the collection of its owner', async () => {
    await build().execute(input());

    expect(deleteCardEntry).toHaveBeenCalledWith(collection.id, ENTRY_ID);
  });

  it('rejects a malformed entry id as a validation error, without reading anything', async () => {
    await expect(build().execute({ ...input(), entryId: 'entry-1' })).rejects.toThrow(
      DomainValidationError,
    );
    expect(findById).not.toHaveBeenCalled();
    expect(deleteCardEntry).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute(input())).rejects.toThrow(CollectionNotFoundError);
    expect(deleteCardEntry).not.toHaveBeenCalled();
  });

  it("refuses to remove an entry of another user's collection", async () => {
    findById.mockResolvedValue(buildCollection(randomUUID()));

    await expect(build().execute(input())).rejects.toThrow(CollectionNotFoundError);
    expect(deleteCardEntry).not.toHaveBeenCalled();
  });

  it('propagates CardEntryNotFoundError thrown by the repository (unknown entry)', async () => {
    deleteCardEntry.mockRejectedValue(new CardEntryNotFoundError());

    await expect(build().execute(input())).rejects.toThrow(CardEntryNotFoundError);
  });
});
