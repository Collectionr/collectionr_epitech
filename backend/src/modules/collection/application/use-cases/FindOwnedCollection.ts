import type { Collection } from '../../domain/entities/Collection';
import { CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

/**
 * Loads a collection on behalf of a user. A collection that does not exist and one that belongs to
 * someone else both end in the same error, so the response never says which ids exist (IDOR,
 * S03 §5.3). Every use case that takes a collection id goes through here: ownership is checked in
 * one place, so a new use case cannot forget it.
 */
export async function findOwnedCollection(
  repository: ICollectionRepository,
  collectionId: string,
  userId: string,
): Promise<Collection> {
  const collection = await repository.findById(collectionId);
  if (collection === null || !collection.isOwnedBy(userId)) {
    throw new CollectionNotFoundError();
  }
  return collection;
}
