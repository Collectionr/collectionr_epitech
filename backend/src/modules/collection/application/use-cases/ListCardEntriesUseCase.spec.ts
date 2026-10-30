import { ListCardEntriesUseCase } from './ListCardEntriesUseCase';
import type { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';

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

describe('ListCardEntriesUseCase', () => {
  const findById = jest.fn();
  const findCardEntries = jest.fn<Promise<Page<CardEntry>>, [string, PageRequest]>();
  const emptyPage: Page<CardEntry> = { items: [], total: 0, page: 1, pageSize: 50 };

  function build(): ListCardEntriesUseCase {
    const collectionRepository = { findById, findCardEntries } as unknown as ICollectionRepository;
    return new ListCardEntriesUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildCollection());
    findCardEntries.mockResolvedValue(emptyPage);
  });

  it('lists the first page of the entries of the collection of its owner', async () => {
    await expect(build().execute({ userId: 'user-1', collectionId: 'collection-1' })).resolves.toBe(
      emptyPage,
    );

    const [collectionId, pageRequest] = findCardEntries.mock.calls[0];
    expect(collectionId).toBe('collection-1');
    expect(pageRequest.page).toBe(1);
    expect(pageRequest.pageSize).toBe(50);
  });

  it('passes the requested page', async () => {
    await build().execute({
      userId: 'user-1',
      collectionId: 'collection-1',
      page: 3,
      pageSize: 20,
    });

    const [, pageRequest] = findCardEntries.mock.calls[0];
    expect(pageRequest.offset).toBe(40);
    expect(pageRequest.pageSize).toBe(20);
  });

  it('rejects an invalid page without reading anything', async () => {
    await expect(
      build().execute({ userId: 'user-1', collectionId: 'collection-1', pageSize: 1000 }),
    ).rejects.toThrow(DomainValidationError);
    expect(findById).not.toHaveBeenCalled();
    expect(findCardEntries).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: 'user-1', collectionId: 'missing' })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(findCardEntries).not.toHaveBeenCalled();
  });

  it("refuses to list the entries of another user's collection", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    await expect(
      build().execute({ userId: 'user-1', collectionId: 'collection-1' }),
    ).rejects.toThrow(CollectionNotFoundError);
    expect(findCardEntries).not.toHaveBeenCalled();
  });
});
