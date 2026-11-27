import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NetworkError } from '../services/apiClient';
import { createAuthHarness, TEST_USER } from './mocks/createAuthHarness';
import { useRestoreSession } from './useRestoreSession';

const ROTATED_TOKENS = { accessToken: 'acces-2', refreshToken: 'renouvellement-2' };

describe('useRestoreSession', () => {
  it('restaure la session au montage, une seule fois même avec deux appels', async () => {
    const { client, store, wrapper } = createAuthHarness(
      { '/auth/refresh': async () => ROTATED_TOKENS, '/users/me': async () => TEST_USER },
      'renouvellement-1',
    );

    renderHook(
      () => {
        useRestoreSession();
        useRestoreSession();
      },
      { wrapper },
    );

    await waitFor(() => expect(store.getState().status).toBe('authenticated'));
    expect(client.request).toHaveBeenCalledTimes(2);
  });

  it('relance la restauration après un échec réseau', async () => {
    let refreshAttempts = 0;
    const { store, wrapper } = createAuthHarness(
      {
        '/auth/refresh': async () => {
          refreshAttempts += 1;
          if (refreshAttempts === 1) {
            throw new NetworkError('connection', 'Failed to fetch');
          }
          return ROTATED_TOKENS;
        },
        '/users/me': async () => TEST_USER,
      },
      'renouvellement-1',
    );
    const { result } = renderHook(() => useRestoreSession(), { wrapper });
    await waitFor(() => expect(store.getState().restoreError).toBeInstanceOf(NetworkError));

    act(() => result.current());

    await waitFor(() => expect(store.getState().status).toBe('authenticated'));
    expect(store.getState().restoreError).toBeNull();
  });
});
