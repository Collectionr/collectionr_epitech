import { UpdateCollectionUseCase } from './UpdateCollectionUseCase';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

function buildCollection(userId = 'user-1'): Collection {
  return Collection.restore({
    id: 'collection-1',
    userId,
    licenceTCGId: 'licence-1',
    name: 'Ma collection',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('UpdateCollectionUseCase', () => {
  const save = jest.fn<Promise<Collection>, [Collection]>();
  const findById = jest.fn();

  function build(): UpdateCollectionUseCase {
    const collectionRepository = { save, findById } as unknown as ICollectionRepository;
    return new UpdateCollectionUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildCollection());
    save.mockImplementation((collection: Collection) => Promise.resolve(collection));
  });

  it('renames the collection and saves it, keeping its owner and licence', async () => {
    const updated = await build().execute({
      userId: 'user-1',
      collectionId: 'collection-1',
      name: 'Doubles',
    });

    expect(updated.name).toBe('Doubles');
    expect(updated.userId).toBe('user-1');
    expect(updated.licenceTCGId).toBe('licence-1');
    expect(save).toHaveBeenCalledWith(updated);
  });

  it('rejects an invalid name without saving anything', async () => {
    await expect(
      build().execute({ userId: 'user-1', collectionId: 'collection-1', name: '' }),
    ).rejects.toThrow(DomainValidationError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      build().execute({ userId: 'user-1', collectionId: 'missing', name: 'Doubles' }),
    ).rejects.toThrow(CollectionNotFoundError);
    expect(save).not.toHaveBeenCalled();
  });

  it("refuses to rename another user's collection, without saving anything", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    await expect(
      build().execute({ userId: 'user-1', collectionId: 'collection-1', name: 'Doubles' }),
    ).rejects.toThrow(CollectionNotFoundError);
    expect(save).not.toHaveBeenCalled();
  });
});
