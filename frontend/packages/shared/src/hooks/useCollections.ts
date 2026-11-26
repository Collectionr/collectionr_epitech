import { useQuery } from '@tanstack/react-query';

import { QUERY_KEYS } from '../constants/queryKeys';
import { COLLECTION_GC_TIME_MS, COLLECTION_STALE_TIME_MS } from '../services/queryClient';
import { useCollectionService } from './collectionServiceContext';

/** Collections de l'utilisateur, les plus récentes d'abord (`GET /collections`). */
export function useCollections() {
  const collectionService = useCollectionService();

  return useQuery({
    queryKey: QUERY_KEYS.collections,
    queryFn: () => collectionService.list(),
    staleTime: COLLECTION_STALE_TIME_MS,
    gcTime: COLLECTION_GC_TIME_MS,
  });
}
