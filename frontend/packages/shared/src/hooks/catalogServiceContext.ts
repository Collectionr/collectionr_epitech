import { createContext, useContext } from 'react';

import type { CatalogService } from '../services/catalogService';

/** Service du catalogue de l'application, fourni une fois à sa racine. */
export const CatalogServiceContext = createContext<CatalogService | null>(null);

/**
 * Lit le service du catalogue fourni à la racine de l'application.
 * @throws {Error} Si aucun service n'est fourni
 */
export function useCatalogService(): CatalogService {
  const catalogService = useContext(CatalogServiceContext);
  if (catalogService === null) {
    throw new Error(
      "CatalogServiceContext absent : fournir le service du catalogue à la racine de l'application",
    );
  }
  return catalogService;
}
