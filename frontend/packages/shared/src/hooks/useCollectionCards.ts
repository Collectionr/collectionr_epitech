import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';

import { QUERY_KEYS } from '../constants/queryKeys';
import { COLLECTION_GC_TIME_MS, COLLECTION_STALE_TIME_MS } from '../services/queryClient';
import type { CollectionCardsPage } from '../types';
import { useCollectionService } from './collectionServiceContext';

/** Pages de cartes d'une collection en cache, chargées une à une (numéro de page à partir de 1). */
export type CollectionCardsData = InfiniteData<CollectionCardsPage, number>;

const FIRST_PAGE = 1;

/**
 * Page suivante d'une liste de cartes, ou `undefined` quand toutes les lignes sont chargées.
 * @param lastPage - Dernière page reçue
 */
export function nextCardsPage(lastPage: CollectionCardsPage): number | undefined {
  return lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined;
}

/**
 * Cartes d'une collection en requête infinie, les plus récentes d'abord. L'API ne propose ni tri
 * ni recherche : seule la pagination est disponible. Inactif tant qu'aucune collection n'est donnée.
 * @param collectionId - Collection, vide pour ne rien charger
 */
export function useCollectionCards(collectionId: string) {
  const collectionService = useCollectionService();

  return useInfiniteQuery({
    queryKey: QUERY_KEYS.cards(collectionId),
    queryFn: ({ pageParam }) => collectionService.listCards(collectionId, pageParam),
    initialPageParam: FIRST_PAGE,
    getNextPageParam: nextCardsPage,
    enabled: collectionId !== '',
    staleTime: COLLECTION_STALE_TIME_MS,
    gcTime: COLLECTION_GC_TIME_MS,
  });
}
