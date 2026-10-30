import { Inject, Injectable } from '@nestjs/common';
import { CardEntryNotFoundError } from '../errors/CollectionErrors';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import { findOwnedCollection } from './FindOwnedCollection';

export interface RemoveCardEntryInput {
  readonly userId: string;
  readonly collectionId: string;
  readonly entryId: string;
}

@Injectable()
export class RemoveCardEntryUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: RemoveCardEntryInput): Promise<void> {
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );
    const entry = await this.collectionRepository.findCardEntryById(collection.id, input.entryId);
    if (entry === null) {
      throw new CardEntryNotFoundError();
    }

    await this.collectionRepository.deleteCardEntry(collection.id, entry.id);
  }
}
