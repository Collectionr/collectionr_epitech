import { CreateCollectionUseCase } from './CreateCollectionUseCase';
import type { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionLimitReachedError, LicenceNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

describe('CreateCollectionUseCase', () => {
  const save = jest.fn<Promise<Collection>, [Collection]>();
  const countByUserId = jest.fn<Promise<number>, [string]>();

  function build(): CreateCollectionUseCase {
    const collectionRepository = { save, countByUserId } as unknown as ICollectionRepository;
    return new CreateCollectionUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    countByUserId.mockResolvedValue(0);
    save.mockImplementation((collection: Collection) => Promise.resolve(collection));
  });

  it('creates a collection owned by the given user and saves it', async () => {
    const collection = await build().execute({
      userId: 'user-1',
      licenceTCGId: 'licence-1',
      name: '  Ma collection Pokémon ',
    });

    expect(collection.userId).toBe('user-1');
    expect(collection.licenceTCGId).toBe('licence-1');
    expect(collection.name).toBe('Ma collection Pokémon');
    expect(save).toHaveBeenCalledWith(collection);
  });

  it('counts the collections of the given user only', async () => {
    await build().execute({ userId: 'user-1', licenceTCGId: 'licence-1', name: 'Doubles' });

    expect(countByUserId).toHaveBeenCalledWith('user-1');
  });

  it('still allows a 10th collection (9 owned)', async () => {
    countByUserId.mockResolvedValue(9);

    await expect(
      build().execute({ userId: 'user-1', licenceTCGId: 'licence-1', name: 'Doubles' }),
    ).resolves.toBeDefined();
    expect(save).toHaveBeenCalled();
  });

  it.each([10, 11])('refuses a new collection when the user already owns %d', async (owned) => {
    countByUserId.mockResolvedValue(owned);

    await expect(
      build().execute({ userId: 'user-1', licenceTCGId: 'licence-1', name: 'Doubles' }),
    ).rejects.toThrow(CollectionLimitReachedError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an invalid name without counting or saving anything', async () => {
    await expect(
      build().execute({ userId: 'user-1', licenceTCGId: 'licence-1', name: '   ' }),
    ).rejects.toThrow(DomainValidationError);
    expect(countByUserId).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('propagates LicenceNotFoundError thrown by save() (unknown licence)', async () => {
    save.mockRejectedValue(new LicenceNotFoundError());

    await expect(
      build().execute({ userId: 'user-1', licenceTCGId: 'missing', name: 'Doubles' }),
    ).rejects.toThrow(LicenceNotFoundError);
  });
});
