import { Inject, Injectable } from '@nestjs/common';
import { Collection } from '../../domain/entities/Collection';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import { findOwnedCollection } from './FindOwnedCollection';

export interface UpdateCollectionInput {
  readonly userId: string;
  readonly collectionId: string;
  readonly name: string;
}

/** Renames a collection. Its owner and its licence never change: the entries depend on the latter. */
@Injectable()
export class UpdateCollectionUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: UpdateCollectionInput): Promise<Collection> {
    // Cheap check first: an invalid name costs no database read.
    Collection.assertValidName(input.name);
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    // Rejects with CollectionNotFoundError if it was deleted since (contract of the port).
    return this.collectionRepository.rename(collection.rename(input.name));
  }
}
