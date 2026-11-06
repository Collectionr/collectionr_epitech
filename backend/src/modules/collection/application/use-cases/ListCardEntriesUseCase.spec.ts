import { randomUUID } from 'node:crypto';
import { ListCardEntriesUseCase } from './ListCardEntriesUseCase';
import type { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';

const USER_ID = randomUUID();

function buildCollection(userId = USER_ID): Collection {
  return Collection.create({ userId, licenceTCGId: randomUUID(), name: 'Ma collection' });
}

describe('ListCardEntriesUseCase', () => {
  const findById = jest.fn();
  const findCardEntries = jest.fn<Promise<Page<CardEntry>>, [string, PageRequest]>();
  const emptyPage: Page<CardEntry> = { items: [], total: 0, page: 1, pageSize: 50 };
  let collection: Collection;

  function build(): ListCardEntriesUseCase {
    return new ListCardEntriesUseCase({
      findById,
      findCardEntries,
    } as unknown as ICollectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    collection = buildCollection();
    findById.mockResolvedValue(collection);
    findCardEntries.mockResolvedValue(emptyPage);
  });

  it('lists the first page of the entries of the collection of its owner', async () => {
    await expect(build().execute({ userId: USER_ID, collectionId: collection.id })).resolves.toBe(
      emptyPage,
    );

    const [collectionId, pageRequest] = findCardEntries.mock.calls[0];
    expect(collectionId).toBe(collection.id);
    expect(pageRequest.page).toBe(1);
    expect(pageRequest.pageSize).toBe(50);
  });

  it('passes the requested page', async () => {
    await build().execute({ userId: USER_ID, collectionId: collection.id, page: 3, pageSize: 20 });

    const [, pageRequest] = findCardEntries.mock.calls[0];
    expect(pageRequest.offset).toBe(40);
    expect(pageRequest.pageSize).toBe(20);
  });

  it('rejects an invalid page without reading anything', async () => {
    await expect(
      build().execute({ userId: USER_ID, collectionId: collection.id, pageSize: 1000 }),
    ).rejects.toThrow(DomainValidationError);
    expect(findById).not.toHaveBeenCalled();
    expect(findCardEntries).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ userId: USER_ID, collectionId: randomUUID() })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(findCardEntries).not.toHaveBeenCalled();
  });

  it("refuses to list the entries of another user's collection", async () => {
    findById.mockResolvedValue(buildCollection(randomUUID()));

    await expect(build().execute({ userId: USER_ID, collectionId: collection.id })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(findCardEntries).not.toHaveBeenCalled();
  });
});
