import { ListCollectionsUseCase } from './ListCollectionsUseCase';
import type { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';

describe('ListCollectionsUseCase', () => {
  const findByUserId = jest.fn<Promise<Page<Collection>>, [string, PageRequest]>();
  const emptyPage: Page<Collection> = { items: [], total: 0, page: 1, pageSize: 50 };

  function build(): ListCollectionsUseCase {
    const collectionRepository = { findByUserId } as unknown as ICollectionRepository;
    return new ListCollectionsUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findByUserId.mockResolvedValue(emptyPage);
  });

  it("lists only the given user's collections, with the default page", async () => {
    await expect(build().execute({ userId: 'user-1' })).resolves.toBe(emptyPage);

    const [userId, pageRequest] = findByUserId.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(pageRequest.page).toBe(1);
    expect(pageRequest.pageSize).toBe(50);
  });

  it('passes the requested page', async () => {
    await build().execute({ userId: 'user-1', page: 2, pageSize: 10 });

    const [, pageRequest] = findByUserId.mock.calls[0];
    expect(pageRequest.offset).toBe(10);
  });

  it('rejects an invalid page without reading anything', async () => {
    await expect(build().execute({ userId: 'user-1', page: 0 })).rejects.toThrow(
      DomainValidationError,
    );
    expect(findByUserId).not.toHaveBeenCalled();
  });
});
