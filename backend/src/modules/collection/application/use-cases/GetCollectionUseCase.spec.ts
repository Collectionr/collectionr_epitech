import { randomUUID } from 'node:crypto';
import { GetCollectionUseCase } from './GetCollectionUseCase';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();
const owned = Collection.create({
  userId: USER_ID,
  licenceTCGId: randomUUID(),
  name: 'Ma collection',
});

describe('GetCollectionUseCase', () => {
  const findById = jest.fn();

  function build(): GetCollectionUseCase {
    return new GetCollectionUseCase({ findById } as unknown as ICollectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("returns the user's own collection", async () => {
    findById.mockResolvedValue(owned);

    await expect(build().execute({ userId: USER_ID, collectionId: owned.id })).resolves.toBe(owned);
    expect(findById).toHaveBeenCalledWith(owned.id);
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: USER_ID, collectionId: randomUUID() })).rejects.toThrow(
      CollectionNotFoundError,
    );
  });

  it("rejects another user's collection with the same error and message as a missing one", async () => {
    findById.mockResolvedValue(owned);
    const forbidden: unknown = await build()
      .execute({ userId: randomUUID(), collectionId: owned.id })
      .catch((caught: unknown) => caught);
    findById.mockResolvedValue(null);
    const missing: unknown = await build()
      .execute({ userId: randomUUID(), collectionId: owned.id })
      .catch((caught: unknown) => caught);

    expect(forbidden).toBeInstanceOf(CollectionNotFoundError);
    expect((forbidden as Error).message).toBe((missing as Error).message);
  });

  it('does not echo the collection id in the error message', async () => {
    findById.mockResolvedValue(null);
    const id = randomUUID();

    await expect(build().execute({ userId: USER_ID, collectionId: id })).rejects.not.toThrow(id);
  });

  it('rejects a malformed collection id as a validation error', async () => {
    await expect(build().execute({ userId: USER_ID, collectionId: 'not-a-uuid' })).rejects.toThrow(
      DomainValidationError,
    );
    expect(findById).not.toHaveBeenCalled();
  });
});
