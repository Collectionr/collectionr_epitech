import { randomUUID } from 'node:crypto';
import { UpdateCollectionUseCase } from './UpdateCollectionUseCase';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();
const LICENCE_ID = randomUUID();

function buildCollection(userId = USER_ID): Collection {
  return Collection.create({ userId, licenceTCGId: LICENCE_ID, name: 'Ma collection' });
}

describe('UpdateCollectionUseCase', () => {
  const rename = jest.fn<Promise<Collection>, [Collection]>();
  const findById = jest.fn();

  function build(): UpdateCollectionUseCase {
    return new UpdateCollectionUseCase({ rename, findById } as unknown as ICollectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    rename.mockImplementation((collection: Collection) => Promise.resolve(collection));
  });

  it('renames the collection and hands it to the repository, keeping its owner and licence', async () => {
    const existing = buildCollection();
    findById.mockResolvedValue(existing);

    const updated = await build().execute({
      userId: USER_ID,
      collectionId: existing.id,
      name: 'Doubles',
    });

    expect(updated.name).toBe('Doubles');
    expect(updated.userId).toBe(USER_ID);
    expect(updated.licenceTCGId).toBe(LICENCE_ID);
    expect(rename).toHaveBeenCalledWith(updated);
  });

  it('rejects an invalid name without reading or writing anything', async () => {
    const existing = buildCollection();
    findById.mockResolvedValue(existing);

    await expect(
      build().execute({ userId: USER_ID, collectionId: existing.id, name: '' }),
    ).rejects.toThrow(DomainValidationError);
    expect(findById).not.toHaveBeenCalled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(
      build().execute({ userId: USER_ID, collectionId: randomUUID(), name: 'Doubles' }),
    ).rejects.toThrow(CollectionNotFoundError);
    expect(rename).not.toHaveBeenCalled();
  });

  it("refuses to rename another user's collection, without writing anything", async () => {
    const existing = buildCollection(randomUUID());
    findById.mockResolvedValue(existing);

    await expect(
      build().execute({ userId: USER_ID, collectionId: existing.id, name: 'Doubles' }),
    ).rejects.toThrow(CollectionNotFoundError);
    expect(rename).not.toHaveBeenCalled();
  });

  it('propagates CollectionNotFoundError thrown by the repository (deleted in the meantime)', async () => {
    const existing = buildCollection();
    findById.mockResolvedValue(existing);
    rename.mockRejectedValue(new CollectionNotFoundError());

    await expect(
      build().execute({ userId: USER_ID, collectionId: existing.id, name: 'Doubles' }),
    ).rejects.toThrow(CollectionNotFoundError);
  });
});
