import { randomUUID } from 'node:crypto';
import { findOwnedCollection } from './FindOwnedCollection';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

describe('findOwnedCollection', () => {
  const findById = jest.fn();
  const repository = { findById } as unknown as ICollectionRepository;
  const userId = randomUUID();
  const owned = Collection.create({ userId, licenceTCGId: randomUUID(), name: 'Ma collection' });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('returns the collection to its owner', async () => {
    findById.mockResolvedValue(owned);

    await expect(findOwnedCollection(repository, owned.id, userId)).resolves.toBe(owned);
  });

  it('throws CollectionNotFoundError for a missing collection', async () => {
    findById.mockResolvedValue(null);

    await expect(findOwnedCollection(repository, owned.id, userId)).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it('throws CollectionNotFoundError, not a "forbidden" error, for someone else\'s collection', async () => {
    findById.mockResolvedValue(owned);

    await expect(findOwnedCollection(repository, owned.id, randomUUID())).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it('rejects a malformed id as a validation error, without querying the store', async () => {
    await expect(findOwnedCollection(repository, 'not-a-uuid', userId)).rejects.toThrow(
      DomainValidationError,
    );
    expect(findById).not.toHaveBeenCalled();
  });
});
