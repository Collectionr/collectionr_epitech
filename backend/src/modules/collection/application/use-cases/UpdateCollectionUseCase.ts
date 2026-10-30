import { Inject, Injectable } from '@nestjs/common';
import type { Collection } from '../../domain/entities/Collection';
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
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    return this.collectionRepository.save(collection.rename(input.name));
  }
}
