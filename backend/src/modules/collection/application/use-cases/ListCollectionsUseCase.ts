import { Inject, Injectable } from '@nestjs/common';
import type { Collection } from '../../domain/entities/Collection';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

export interface ListCollectionsInput {
  /** Only this user's collections are ever listed: there is no way to ask for another user's. */
  readonly userId: string;
}

/** Not paginated: a user owns at most MAX_COLLECTIONS_PER_USER (10) collections. */
@Injectable()
export class ListCollectionsUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: ListCollectionsInput): Promise<readonly Collection[]> {
    return this.collectionRepository.findByUserId(input.userId);
  }
}
