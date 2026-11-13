import { Inject, Injectable } from '@nestjs/common';
import type { Collection } from '../../domain/entities/Collection';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import { findOwnedCollection } from './FindOwnedCollection';

export interface GetCollectionInput {
  readonly userId: string;
  readonly collectionId: string;
}

@Injectable()
export class GetCollectionUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: GetCollectionInput): Promise<Collection> {
    return findOwnedCollection(this.collectionRepository, input.collectionId, input.userId);
  }
}
