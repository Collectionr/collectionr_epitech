import { RemoveCardEntryUseCase } from './RemoveCardEntryUseCase';
import { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { CardEntryNotFoundError, CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

function buildCollection(userId = 'user-1'): Collection {
  return Collection.restore({
    id: 'collection-1',
    userId,
    licenceTCGId: 'licence-1',
    name: 'Ma collection',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function buildEntry(): CardEntry {
  return CardEntry.restore({
    id: 'entry-1',
    collectionId: 'collection-1',
    cardId: 'card-1',
    variantId: null,
    quantity: 1,
    condition: 'NM',
    language: 'en',
    gradingNote: null,
    notes: null,
    addedAt: new Date(),
    updatedAt: new Date(),
  });
}

const input = { userId: 'user-1', collectionId: 'collection-1', entryId: 'entry-1' };

describe('RemoveCardEntryUseCase', () => {
  const findById = jest.fn();
  const findCardEntryById = jest.fn();
  const deleteCardEntry = jest.fn<Promise<void>, [string, string]>();

  function build(): RemoveCardEntryUseCase {
    const collectionRepository = {
      findById,
      findCardEntryById,
      deleteCardEntry,
    } as unknown as ICollectionRepository;
    return new RemoveCardEntryUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildCollection());
    findCardEntryById.mockResolvedValue(buildEntry());
    deleteCardEntry.mockResolvedValue(undefined);
  });

  it('removes the entry from the collection of its owner', async () => {
    await build().execute(input);

    expect(findCardEntryById).toHaveBeenCalledWith('collection-1', 'entry-1');
    expect(deleteCardEntry).toHaveBeenCalledWith('collection-1', 'entry-1');
  });

  it('rejects when the entry does not exist in the collection', async () => {
    findCardEntryById.mockResolvedValue(null);

    await expect(build().execute(input)).rejects.toThrow(CardEntryNotFoundError);
    expect(deleteCardEntry).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute(input)).rejects.toThrow(CollectionNotFoundError);
    expect(deleteCardEntry).not.toHaveBeenCalled();
  });

  it("refuses to remove an entry of another user's collection", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    await expect(build().execute(input)).rejects.toThrow(CollectionNotFoundError);
    expect(findCardEntryById).not.toHaveBeenCalled();
    expect(deleteCardEntry).not.toHaveBeenCalled();
  });
});
