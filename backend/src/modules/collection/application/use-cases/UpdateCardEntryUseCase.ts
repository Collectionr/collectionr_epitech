import { Inject, Injectable } from '@nestjs/common';
import { CardEntry } from '../../domain/entities/CardEntry';
import type { CardEntryChanges } from '../../domain/entities/CardEntry';
import { assertUuid } from '../../domain/rules/AssertUuid';
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

/**
 * Sends the repository the validated fields only, never a whole entry read beforehand: a
 * read-modify-write of the full row would let a stale copy silently undo a concurrent edit
 * (two tabs, desktop and mobile).
 */
@Injectable()
export class UpdateCardEntryUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: UpdateCardEntryInput): Promise<CardEntry> {
    // Cheap checks first: invalid input costs no database read.
    assertUuid(input.entryId, 'Entry id');
    const changes = CardEntry.validateChanges(input.changes);
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    // Rejects with CardEntryNotFoundError if the entry is not in this collection (contract of the port).
    return this.collectionRepository.updateCardEntry(collection.id, input.entryId, changes);
  }
}
