import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QUERY_KEYS } from '../constants/queryKeys';
import { NetworkError } from '../services/apiClient';
import { createAuthHarness, TEST_USER } from './mocks/createAuthHarness';
import { useLogout } from './useLogout';

function createConnectedHarness(logout: () => Promise<unknown>) {
  const harness = createAuthHarness({ '/auth/logout': logout }, 'renouvellement-1');
  harness.store.getState().startSession(TEST_USER, 'acces-1');
  harness.queryClient.setQueryData(QUERY_KEYS.me, TEST_USER);
  harness.queryClient.setQueryData(QUERY_KEYS.collections, ['Base']);
  return harness;
}

describe('useLogout', () => {
  it('révoque le jeton, ferme la session et vide le cache', async () => {
    const { client, storage, store, queryClient, wrapper } = createConnectedHarness(
      async () => undefined,
    );
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(client.request).toHaveBeenCalledWith('/auth/logout', {
      method: 'POST',
      body: { refreshToken: 'renouvellement-1' },
    });
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.current()).toBeNull();
    expect(store.getState().status).toBe('anonymous');
  });

  it('vide le cache et ferme la session même si le back échoue', async () => {
    const { storage, store, queryClient, wrapper } = createConnectedHarness(() =>
      Promise.reject(new NetworkError('connection', 'Failed to fetch')),
    );
    const { result } = renderHook(() => useLogout(), { wrapper });

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(NetworkError);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(storage.current()).toBeNull();
    expect(store.getState().status).toBe('anonymous');
  });
});
