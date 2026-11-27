import { CATALOG_SEARCH } from '../constants/catalog';
import type { CatalogCard } from '../types';
import type { AbortSignalLike, ApiClient, ApiPath } from './apiClient';
import { parseCardView, parseSetView, parseVariantView } from './catalogViews';
import { parseList, readField } from './responseReaders';

/**
 * Chemin supposé de la recherche dans le catalogue. Aucun endpoint n'existe encore côté back
 * (COLLR-459) : ce contrat est une proposition à valider avec le back, et ce fichier est le seul
 * endroit du front à adapter quand le vrai contrat sera livré (avec le handler simulé).
 */
export const CATALOG_SEARCH_PATH: ApiPath = '/catalogue/cards/search';

/** Catalogue des cartes, en lecture seule. */
export interface CatalogService {
  /**
   * Cherche des cartes par nom, français ou anglais (comme le dépôt du back : sans tenir compte de
   * la casse, mais des accents). Triées par nom anglais.
   * @param term - Texte saisi, de 2 à 100 caractères
   * @param options - `signal` annule la recherche devenue obsolète
   * @returns Au plus 20 cartes, avec leur set et leurs impressions
   * @throws {ApiError} 400 si le terme est refusé
   * @throws {RequestAbortedError} Si la recherche est annulée par son signal
   */
  search(term: string, options?: { signal?: AbortSignalLike }): Promise<CatalogCard[]>;
}

/** Options de création du service. */
export interface CatalogServiceOptions {
  /** Client API de l'application */
  client: ApiClient;
}

function parseCatalogCard(value: unknown, path: string): CatalogCard {
  return {
    card: parseCardView(readField(value, 'card'), path),
    set: parseSetView(readField(value, 'set'), path),
    variants: parseList(readField(value, 'variants'), path, (variant) =>
      parseVariantView(variant, path),
    ),
  };
}

/**
 * Crée le service du catalogue.
 * @param options - Client API de l'application
 * @returns Le service, sans état : le cache est celui de TanStack Query
 */
export function createCatalogService({ client }: CatalogServiceOptions): CatalogService {
  return {
    async search(term, { signal } = {}) {
      const query = `q=${encodeURIComponent(term)}&limit=${CATALOG_SEARCH.limit}`;
      const body = await client.request(`${CATALOG_SEARCH_PATH}?${query}`, { signal });
      return parseList(body, CATALOG_SEARCH_PATH, (item) =>
        parseCatalogCard(item, CATALOG_SEARCH_PATH),
      );
    },
  };
}
