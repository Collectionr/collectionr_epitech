import { Inject, Injectable } from '@nestjs/common';
import { CardEntry } from '../../domain/entities/CardEntry';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import { findOwnedCollection } from './FindOwnedCollection';

export interface AddCardEntryInput {
  readonly userId: string;
  readonly collectionId: string;
  readonly cardId: string;
  readonly variantId?: string | null;
  readonly quantity: number;
  readonly condition: string;
  readonly language: string;
  readonly gradingNote?: number | null;
  readonly notes?: string | null;
}

/**
 * Every call adds a NEW entry: two adds of the same card give two entries, they are not merged.
 * Whether identical entries should be merged is a product decision that has not been taken.
 */
@Injectable()
export class AddCardEntryUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: AddCardEntryInput): Promise<CardEntry> {
    // Cheap checks first: an invalid entry costs no database read. The entry only becomes the
    // collection's once ownership is confirmed below.
    const entry = CardEntry.create({
      collectionId: input.collectionId,
      cardId: input.cardId,
      variantId: input.variantId,
      quantity: input.quantity,
      condition: input.condition,
      language: input.language,
      gradingNote: input.gradingNote,
      notes: input.notes,
    });
    await findOwnedCollection(this.collectionRepository, input.collectionId, input.userId);

    // Rejects with CardNotFoundError when the card or the variant is unknown, or when the card is
    // not from the collection's licence (contract of the port).
    return this.collectionRepository.addCardEntry(entry);
  }
}
