import { Inject, Injectable } from '@nestjs/common';
import { Collection } from '../../domain/entities/Collection';
import { MAX_COLLECTIONS_PER_USER } from '../../domain/rules/CollectionLimits';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

export interface CreateCollectionInput {
  /** The authenticated user: the owner is never taken from the request body. */
  readonly userId: string;
  readonly licenceTCGId: string;
  readonly name: string;
}

@Injectable()
export class CreateCollectionUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: CreateCollectionInput): Promise<Collection> {
    const collection = Collection.create({
      userId: input.userId,
      licenceTCGId: input.licenceTCGId,
      name: input.name,
    });

    // The repository checks the limit atomically with the insert, and rejects with
    // CollectionLimitReachedError or LicenceNotFoundError (contract of the port).
    return this.collectionRepository.create(collection, MAX_COLLECTIONS_PER_USER);
  }
}
