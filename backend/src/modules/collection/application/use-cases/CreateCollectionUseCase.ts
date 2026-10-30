import { Inject, Injectable } from '@nestjs/common';
import { Collection } from '../../domain/entities/Collection';
import { MAX_COLLECTIONS_PER_USER } from '../../domain/rules/CollectionLimits';
import { CollectionLimitReachedError } from '../errors/CollectionErrors';
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

    // This count-then-save is a fast, friendly check, not a guarantee: two concurrent requests
    // can both pass it. The implementation of the port (COLLR-417) must close that gap.
    if ((await this.collectionRepository.countByUserId(input.userId)) >= MAX_COLLECTIONS_PER_USER) {
      throw new CollectionLimitReachedError();
    }

    // Rejects with LicenceNotFoundError when the licence is unknown (contract of the port).
    return this.collectionRepository.save(collection);
  }
}
