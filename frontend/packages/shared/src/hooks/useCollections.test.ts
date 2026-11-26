import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QUERY_KEYS } from '../constants/queryKeys';
import { ApiError } from '../services/apiClient';
import { createCollectionHarness, TEST_COLLECTION } from './mocks/createCollectionHarness';
import { useCollections } from './useCollections';

describe('useCollections', () => {
  it('charge les collections de l’utilisateur et les met en cache', async () => {
    const { queryClient, wrapper } = createCollectionHarness({
      '/collections': async () => [TEST_COLLECTION],
    });
    const { result } = renderHook(() => useCollections(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([TEST_COLLECTION]);
    expect(queryClient.getQueryData(QUERY_KEYS.collections)).toEqual([TEST_COLLECTION]);
  });

  it('expose l’erreur de l’API sans relancer une 4xx', async () => {
    const { client, wrapper } = createCollectionHarness({
      '/collections': () =>
        Promise.reject(new ApiError({ status: 403, code: 'Forbidden', message: 'Forbidden' })),
    });
    const { result } = renderHook(() => useCollections(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  it('exige le service des collections à la racine', () => {
    expect(() => renderHook(() => useCollections())).toThrow('CollectionServiceContext absent');
  });
});
