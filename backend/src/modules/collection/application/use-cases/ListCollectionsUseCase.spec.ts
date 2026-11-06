import { randomUUID } from 'node:crypto';
import { ListCollectionsUseCase } from './ListCollectionsUseCase';
import { Collection } from '../../domain/entities/Collection';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

describe('ListCollectionsUseCase', () => {
  const findByUserId = jest.fn<Promise<readonly Collection[]>, [string]>();

  it("lists only the given user's collections", async () => {
    const userId = randomUUID();
    const collections = [
      Collection.create({ userId, licenceTCGId: randomUUID(), name: 'A' }),
      Collection.create({ userId, licenceTCGId: randomUUID(), name: 'B' }),
    ];
    findByUserId.mockResolvedValue(collections);
    const useCase = new ListCollectionsUseCase({
      findByUserId,
    } as unknown as ICollectionRepository);

    await expect(useCase.execute({ userId })).resolves.toBe(collections);
    expect(findByUserId).toHaveBeenCalledWith(userId);
  });
});
