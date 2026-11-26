import { createContext, useContext } from 'react';

import type { CollectionService } from '../services/collectionService';

/** Service des collections de l'application, fourni une fois à sa racine. */
export const CollectionServiceContext = createContext<CollectionService | null>(null);

/**
 * Lit le service des collections fourni à la racine de l'application.
 * @throws {Error} Si aucun service n'est fourni
 */
export function useCollectionService(): CollectionService {
  const collectionService = useContext(CollectionServiceContext);
  if (collectionService === null) {
    throw new Error(
      "CollectionServiceContext absent : fournir le service des collections à la racine de l'application",
    );
  }
  return collectionService;
}
