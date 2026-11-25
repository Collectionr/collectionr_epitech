import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAuthHarness, TEST_USER } from './mocks/createAuthHarness';
import { useMe } from './useMe';

describe('useMe', () => {
  it('démarre sur l’utilisateur de la session, sans appel', async () => {
    const { client, store, wrapper } = createAuthHarness({ '/users/me': async () => TEST_USER });
    store.getState().startSession(TEST_USER, 'acces-1');

    const { result } = renderHook(() => useMe(), { wrapper });

    expect(result.current.data).toEqual(TEST_USER);
    expect(result.current.isFetching).toBe(false);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('reste inactif hors session', () => {
    const { client, store, wrapper } = createAuthHarness({ '/users/me': async () => TEST_USER });
    store.getState().endSession();

    const { result } = renderHook(() => useMe(), { wrapper });

    expect(result.current.data).toBeUndefined();
    expect(result.current.fetchStatus).toBe('idle');
    expect(client.request).not.toHaveBeenCalled();
  });
});
