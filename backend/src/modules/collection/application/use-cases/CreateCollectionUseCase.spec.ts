import { randomUUID } from 'node:crypto';
import { CreateCollectionUseCase } from './CreateCollectionUseCase';
import type { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionLimitReachedError, LicenceNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();
const LICENCE_ID = randomUUID();

describe('CreateCollectionUseCase', () => {
  const create = jest.fn<Promise<Collection>, [Collection, number]>();

  function build(): CreateCollectionUseCase {
    return new CreateCollectionUseCase({ create } as unknown as ICollectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    create.mockImplementation((collection: Collection) => Promise.resolve(collection));
  });

  it('creates a collection owned by the given user and hands it to the repository', async () => {
    const collection = await build().execute({
      userId: USER_ID,
      licenceTCGId: LICENCE_ID,
      name: '  Ma collection Pokémon ',
    });

    expect(collection.userId).toBe(USER_ID);
    expect(collection.licenceTCGId).toBe(LICENCE_ID);
    expect(collection.name).toBe('Ma collection Pokémon');
    expect(create).toHaveBeenCalledWith(collection, expect.any(Number));
  });

  it('asks the repository to enforce the limit of 10 collections per user', async () => {
    await build().execute({ userId: USER_ID, licenceTCGId: LICENCE_ID, name: 'Doubles' });

    expect(create.mock.calls[0][1]).toBe(10);
  });

  it('propagates CollectionLimitReachedError thrown by the repository', async () => {
    create.mockRejectedValue(new CollectionLimitReachedError());

    await expect(
      build().execute({ userId: USER_ID, licenceTCGId: LICENCE_ID, name: 'Doubles' }),
    ).rejects.toThrow(CollectionLimitReachedError);
  });

  it('propagates LicenceNotFoundError thrown by the repository (unknown licence)', async () => {
    create.mockRejectedValue(new LicenceNotFoundError());

    await expect(
      build().execute({ userId: USER_ID, licenceTCGId: randomUUID(), name: 'Doubles' }),
    ).rejects.toThrow(LicenceNotFoundError);
  });

  it.each([
    ['name', { name: '   ' }],
    ['licence id', { licenceTCGId: 'licence-1' }],
  ])('rejects an invalid %s without reaching the repository', async (_label, override) => {
    await expect(
      build().execute({ userId: USER_ID, licenceTCGId: LICENCE_ID, name: 'Doubles', ...override }),
    ).rejects.toThrow(DomainValidationError);
    expect(create).not.toHaveBeenCalled();
  });
});
