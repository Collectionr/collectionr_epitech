import { DeleteCollectionUseCase } from './DeleteCollectionUseCase';
import { Collection } from '../../domain/entities/Collection';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
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

describe('DeleteCollectionUseCase', () => {
  const findById = jest.fn();
  const deleteCollection = jest.fn<Promise<void>, [string]>();

  function build(): DeleteCollectionUseCase {
    const collectionRepository = {
      findById,
      delete: deleteCollection,
    } as unknown as ICollectionRepository;
    return new DeleteCollectionUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildCollection());
    deleteCollection.mockResolvedValue(undefined);
  });

  it('deletes the collection of its owner', async () => {
    await build().execute({ userId: 'user-1', collectionId: 'collection-1' });

    expect(deleteCollection).toHaveBeenCalledWith('collection-1');
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'user-1', collectionId: 'missing' })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it("refuses to delete another user's collection", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    await expect(
      build().execute({ userId: 'user-1', collectionId: 'collection-1' }),
    ).rejects.toThrow(CollectionNotFoundError);
    expect(deleteCollection).not.toHaveBeenCalled();
  });

  it('propagates a failure of the repository', async () => {
    deleteCollection.mockRejectedValue(new Error('database down'));

    await expect(
      build().execute({ userId: 'user-1', collectionId: 'collection-1' }),
    ).rejects.toThrow('database down');
  });
});
