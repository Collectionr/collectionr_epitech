import { Inject, Injectable } from '@nestjs/common';
import type { Collection } from '../../domain/entities/Collection';
import { PageRequest } from '../../domain/value-objects/PageRequest';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import type { Page } from '../ports/Page';

export interface ListCollectionsInput {
  /** Only this user's collections are ever listed: there is no way to ask for another user's. */
  readonly userId: string;
  readonly page?: number;
  readonly pageSize?: number;
}

@Injectable()
export class ListCollectionsUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: ListCollectionsInput): Promise<Page<Collection>> {
    const pageRequest = PageRequest.create({ page: input.page, pageSize: input.pageSize });

    return this.collectionRepository.findByUserId(input.userId, pageRequest);
  }
}
