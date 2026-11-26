import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { CATALOG_SEARCH } from '../constants/catalog';
import { QUERY_KEYS } from '../constants/queryKeys';
import { DEFAULT_STALE_TIME_MS } from '../services/queryClient';
import type { CatalogCard } from '../types';
import { useCatalogService } from './catalogServiceContext';
import { useDebouncedValue } from './useDebouncedValue';

/** État de l'autocomplétion du catalogue. */
export interface CatalogSearchState {
  /** Le texte saisi est assez long pour lancer une recherche (2 à 100 caractères) */
  canSearch: boolean;
  /**
   * Cartes trouvées pour `searchedTerm`. Pendant une nouvelle recherche, les précédentes restent
   * affichées : la liste ne clignote pas.
   */
  results: CatalogCard[];
  /** Terme des cartes affichées, vide tant qu'aucune recherche n'a abouti */
  searchedTerm: string;
  /** Une recherche est attendue ou en cours pour le texte saisi */
  isSearching: boolean;
  /** Échec de la recherche du texte saisi, `null` sinon */
  error: Error | null;
  /** Relance la recherche en échec */
  retry: () => void;
}

/** Résultat mis en cache : les cartes et le terme auquel elles répondent. */
interface CatalogSearchResult {
  term: string;
  cards: CatalogCard[];
}

function isSearchable(term: string): boolean {
  return term.length >= CATALOG_SEARCH.minLength && term.length <= CATALOG_SEARCH.maxLength;
}

/**
 * Autocomplétion du catalogue : la recherche part 200 ms après la dernière frappe, à partir de
 * 2 caractères (espaces de début et de fin ignorés). Une recherche devenue obsolète est annulée
 * (son signal interrompt la requête) ; une recherche déjà faite est servie par le cache pendant
 * 5 min, sans nouvel appel.
 * @param text - Texte saisi dans le champ de recherche
 */
export function useSearchCatalog(text: string): CatalogSearchState {
  const catalogService = useCatalogService();
  const term = text.trim();
  const debouncedTerm = useDebouncedValue(term, CATALOG_SEARCH.debounceMs);
  const canSearch = isSearchable(term);
  const searchEnabled = canSearch && isSearchable(debouncedTerm);

  const query = useQuery({
    queryKey: QUERY_KEYS.catalog(debouncedTerm),
    queryFn: async ({ signal }): Promise<CatalogSearchResult> => ({
      term: debouncedTerm,
      cards: await catalogService.search(debouncedTerm, { signal }),
    }),
    enabled: searchEnabled,
    placeholderData: keepPreviousData,
    // « Même requête retapée = réponse instantanée » (COLLR-702) : 5 min, la valeur par défaut.
    staleTime: DEFAULT_STALE_TIME_MS,
  });

  const shown = searchEnabled ? query.data : undefined;
  return {
    canSearch,
    results: shown?.cards ?? [],
    searchedTerm: shown?.term ?? '',
    isSearching: canSearch && (term !== debouncedTerm || query.isFetching),
    error: searchEnabled ? query.error : null,
    retry: () => {
      void query.refetch();
    },
  };
}
