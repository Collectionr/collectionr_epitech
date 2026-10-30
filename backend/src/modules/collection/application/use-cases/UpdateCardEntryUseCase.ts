import { Inject, Injectable } from '@nestjs/common';
import type { CardEntry, CardEntryChanges } from '../../domain/entities/CardEntry';
import { CardEntryNotFoundError } from '../errors/CollectionErrors';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import { findOwnedCollection } from './FindOwnedCollection';

export interface UpdateCardEntryInput {
  readonly userId: string;
  readonly collectionId: string;
  readonly entryId: string;
  /** Only quantity, condition, language, grading note and notes: see CardEntryChanges. */
  readonly changes: CardEntryChanges;
}

@Injectable()
export class UpdateCardEntryUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: UpdateCardEntryInput): Promise<CardEntry> {
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );
    const entry = await this.collectionRepository.findCardEntryById(collection.id, input.entryId);
    if (entry === null) {
      throw new CardEntryNotFoundError();
    }

    return this.collectionRepository.saveCardEntry(entry.update(input.changes));
  }
}
