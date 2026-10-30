import { Inject, Injectable } from '@nestjs/common';
import { COLLECTION_REPOSITORY } from '../ports/ICollectionRepository';
import type { ICollectionRepository } from '../ports/ICollectionRepository';
import { findOwnedCollection } from './FindOwnedCollection';

export interface DeleteCollectionInput {
  readonly userId: string;
  readonly collectionId: string;
}

/**
 * Deletes a collection together with all its card entries (atomically, see the port). Irreversible:
 * the interface layer is expected to trace it with `@Audit` (CONVENTIONS.md, "Journalisation d'audit").
 */
@Injectable()
export class DeleteCollectionUseCase {
  constructor(
    @Inject(COLLECTION_REPOSITORY) private readonly collectionRepository: ICollectionRepository,
  ) {}

  async execute(input: DeleteCollectionInput): Promise<void> {
    const collection = await findOwnedCollection(
      this.collectionRepository,
      input.collectionId,
      input.userId,
    );

    await this.collectionRepository.delete(collection.id);
  }
}
