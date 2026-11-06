import { randomUUID } from 'node:crypto';
import { DeleteCollectionUseCase } from './DeleteCollectionUseCase';
import { Collection } from '../../domain/entities/Collection';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();

function buildCollection(userId = USER_ID): Collection {
  return Collection.create({ userId, licenceTCGId: randomUUID(), name: 'Ma collection' });
}

describe('DeleteCollectionUseCase', () => {
  const findById = jest.fn();
  const deleteCollection = jest.fn<Promise<void>, [string]>();

  function build(): DeleteCollectionUseCase {
    return new DeleteCollectionUseCase({
      findById,
      delete: deleteCollection,
    } as unknown as ICollectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    deleteCollection.mockResolvedValue(undefined);
  });

  it('deletes the collection of its owner', async () => {
    const existing = buildCollection();
    findById.mockResolvedValue(existing);

    await build().execute({ userId: USER_ID, collectionId: existing.id });

    expect(deleteCollection).toHaveBeenCalledWith(existing.id);
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: USER_ID, collectionId: randomUUID() })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it("refuses to delete another user's collection", async () => {
    const existing = buildCollection(randomUUID());
    findById.mockResolvedValue(existing);

    await expect(build().execute({ userId: USER_ID, collectionId: existing.id })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it('propagates a failure of the repository', async () => {
    const existing = buildCollection();
    findById.mockResolvedValue(existing);
    deleteCollection.mockRejectedValue(new Error('database down'));

    await expect(build().execute({ userId: USER_ID, collectionId: existing.id })).rejects.toThrow(
      'database down',
    );
  });
});
