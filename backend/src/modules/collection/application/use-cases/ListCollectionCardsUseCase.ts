import { Inject, Injectable } from '@nestjs/common';
import { PageRequest } from '../../domain/value-objects/PageRequest';
import { CARD_ENTRY_VIEW_READER } from '../ports/ICardEntryViewReader';
import type { CardEntryView, ICardEntryViewReader } from '../ports/ICardEntryViewReader';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';
import { findOwnedCollection } from './FindOwnedCollection';

export interface ListCollectionCardsInput {
  readonly userId: string;
  readonly collectionId: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * The cards of a collection with their catalogue data (name, set, image), one page at a time.
 * ListCardEntriesUseCase returns the bare entries (identifiers only); this is what the screen reads.
 */
@Injectable()
export class ListCollectionCardsUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
    @Inject(CARD_ENTRY_VIEW_READER) private readonly viewReader: ICardEntryViewReader,
  ) {}

  async execute(input: ListCollectionCardsInput): Promise<Page<CardEntryView>> {
    // Cheap check first: a bad page request costs no database read.
    const pageRequest = PageRequest.create({ page: input.page, pageSize: input.pageSize });
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    return this.viewReader.findCardEntryViews(collection.id, pageRequest);
  }
}
