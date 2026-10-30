import { findOwnedCollection } from './FindOwnedCollection';
import { Collection } from '../../domain/entities/Collection';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

describe('findOwnedCollection', () => {
  const findById = jest.fn();
  const repository = { findById } as unknown as ICollectionRepository;
  const owned = Collection.restore({
    id: 'collection-1',
    userId: 'user-1',
    licenceTCGId: 'licence-1',
    name: 'Ma collection',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the collection to its owner', async () => {
    findById.mockResolvedValue(owned);

    await expect(findOwnedCollection(repository, 'collection-1', 'user-1')).resolves.toBe(owned);
  });

  it('throws CollectionNotFoundError for a missing collection', async () => {
    findById.mockResolvedValue(null);

    await expect(findOwnedCollection(repository, 'collection-1', 'user-1')).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it('throws CollectionNotFoundError, not a "forbidden" error, for someone else\'s collection', async () => {
    findById.mockResolvedValue(owned);

    await expect(findOwnedCollection(repository, 'collection-1', 'user-2')).rejects.toThrow(
      CollectionNotFoundError,
    );
  });
});
