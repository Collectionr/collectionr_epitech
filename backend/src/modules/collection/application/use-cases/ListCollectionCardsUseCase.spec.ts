import { randomUUID } from 'node:crypto';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { CardEntryView } from '../ports/ICardEntryViewReader';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';
import { ListCollectionCardsUseCase } from './ListCollectionCardsUseCase';

const USER_ID = randomUUID();

describe('ListCollectionCardsUseCase', () => {
  const findById = jest.fn();
  const findCardEntryViews = jest.fn<Promise<Page<CardEntryView>>, [string, PageRequest]>();
  const emptyPage: Page<CardEntryView> = { items: [], total: 0, page: 1, pageSize: 50 };
  let collection: Collection;

  function build(): ListCollectionCardsUseCase {
    return new ListCollectionCardsUseCase({ findById } as unknown as ICollectionRepository, {
      findCardEntryViews,
    });
  }

  beforeEach(() => {
    jest.resetAllMocks();
    collection = Collection.create({ userId: USER_ID, licenceTCGId: randomUUID(), name: 'Ma' });
    findById.mockResolvedValue(collection);
    findCardEntryViews.mockResolvedValue(emptyPage);
  });

  it('reads the first page of the collection of its owner, 50 entries by default', async () => {
    await expect(build().execute({ userId: USER_ID, collectionId: collection.id })).resolves.toBe(
      emptyPage,
    );

    const [collectionId, pageRequest] = findCardEntryViews.mock.calls[0];
    expect(collectionId).toBe(collection.id);
    expect(pageRequest).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('passes the requested page', async () => {
    await build().execute({
      userId: USER_ID,
      collectionId: collection.id,
      page: 3,
      pageSize: 20,
    });

    expect(findCardEntryViews.mock.calls[0][1]).toMatchObject({ page: 3, pageSize: 20 });
  });

  it('answers CollectionNotFoundError for a collection of someone else, and reads nothing', async () => {
    await expect(
      build().execute({ userId: randomUUID(), collectionId: collection.id }),
    ).rejects.toBeInstanceOf(CollectionNotFoundError);

    expect(findCardEntryViews).not.toHaveBeenCalled();
  });

  it('rejects an invalid page request before touching the store', async () => {
    await expect(
      build().execute({ userId: USER_ID, collectionId: collection.id, pageSize: 101 }),
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(findById).not.toHaveBeenCalled();
  });
});
