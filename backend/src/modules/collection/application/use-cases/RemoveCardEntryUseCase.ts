import { Inject, Injectable } from '@nestjs/common';
import { assertUuid } from '../../domain/rules/AssertUuid';
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
    assertUuid(input.entryId, 'Entry id');
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    // Rejects with CardEntryNotFoundError if the entry is not in this collection (contract of the port).
    await this.collectionRepository.deleteCardEntry(collection.id, input.entryId);
  }
}
