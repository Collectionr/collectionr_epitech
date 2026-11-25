import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QUERY_KEYS } from '../constants/queryKeys';
import { ApiError } from '../services/apiClient';
import { createAuthHarness, TEST_USER } from './mocks/createAuthHarness';
import { useLogin } from './useLogin';

const CREDENTIALS = { email: 'ash@exemple.fr', password: 'pikachu25' };

describe('useLogin', () => {
  it('ouvre la session et met le profil en cache', async () => {
    const { store, queryClient, wrapper } = createAuthHarness({
      '/auth/login': async () => ({
        user: TEST_USER,
        accessToken: 'acces-1',
        refreshToken: 'renouvellement-1',
      }),
    });
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(() => result.current.mutateAsync(CREDENTIALS));

    expect(queryClient.getQueryData(QUERY_KEYS.me)).toEqual(TEST_USER);
    expect(store.getState().status).toBe('authenticated');
  });

  it('expose l’erreur sans mettre de profil en cache', async () => {
    const { queryClient, wrapper } = createAuthHarness({
      '/auth/login': () =>
        Promise.reject(
          new ApiError({ status: 401, code: 'Unauthorized', message: 'Invalid email or password' }),
        ),
    });
    const { result } = renderHook(() => useLogin(), { wrapper });

    act(() => result.current.mutate(CREDENTIALS));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(queryClient.getQueryData(QUERY_KEYS.me)).toBeUndefined();
  });
});
