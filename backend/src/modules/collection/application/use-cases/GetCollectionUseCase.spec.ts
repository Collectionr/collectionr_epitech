import { GetCollectionUseCase } from './GetCollectionUseCase';
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

describe('GetCollectionUseCase', () => {
  const findById = jest.fn();

  function build(): GetCollectionUseCase {
    const collectionRepository = { findById } as unknown as ICollectionRepository;
    return new GetCollectionUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns the user's own collection", async () => {
    const owned = buildCollection();
    findById.mockResolvedValue(owned);

    await expect(build().execute({ userId: 'user-1', collectionId: 'collection-1' })).resolves.toBe(
      owned,
    );
    expect(findById).toHaveBeenCalledWith('collection-1');
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'user-1', collectionId: 'missing' })).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it("rejects another user's collection with the same error as a missing one", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    const error: unknown = await build()
      .execute({ userId: 'user-1', collectionId: 'collection-1' })
      .catch((caught: unknown) => caught);
    findById.mockResolvedValue(null);
    const missing: unknown = await build()
      .execute({ userId: 'user-1', collectionId: 'collection-1' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CollectionNotFoundError);
    expect((error as Error).message).toBe((missing as Error).message);
  });

  it('does not echo the collection id in the error message', async () => {
    findById.mockResolvedValue(null);

    await expect(
      build().execute({ userId: 'user-1', collectionId: 'secret-id-123' }),
    ).rejects.not.toThrow(/secret-id-123/);
  });
});
