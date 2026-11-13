import { Inject, Injectable } from '@nestjs/common';
import type { CardEntry } from '../../domain/entities/CardEntry';
import { PageRequest } from '../../domain/value-objects/PageRequest';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';
import { findOwnedCollection } from './FindOwnedCollection';

export interface ListCardEntriesInput {
  readonly userId: string;
  readonly collectionId: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Collections reach 10 000 entries (CDC §3.1.3): they are only ever read one page at a time.
 *
 * Returns the bare entries (identifiers only). Not registered in CollectionModule and exposed by no
 * route: `GET /collections/:id/cards` serves ListCollectionCardsUseCase, which joins the catalogue.
 * Kept, with its tests, as the read for a caller that only needs the entries (COLLR-419); register it
 * in the module when one appears.
 */
@Injectable()
export class ListCardEntriesUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: ListCardEntriesInput): Promise<Page<CardEntry>> {
    // Cheap check first: a bad page request costs no database read.
    const pageRequest = PageRequest.create({ page: input.page, pageSize: input.pageSize });
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    return this.collectionRepository.findCardEntries(collection.id, pageRequest);
  }
}
