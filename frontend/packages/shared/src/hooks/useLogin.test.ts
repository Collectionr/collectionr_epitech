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

  it('ne garde aucune donnée du compte précédent, expiré sans rechargement de la page', async () => {
    const otherUser = {
      ...TEST_USER,
      id: 'b4e1a2c3-0000-4000-8000-000000000002',
      username: 'misty',
    };
    const { authService, store, queryClient, wrapper } = createAuthHarness({
      '/auth/login': async () => ({
        user: TEST_USER,
        accessToken: 'acces-2',
        refreshToken: 'renouvellement-2',
      }),
    });
    store.getState().startSession(otherUser, 'acces-1');
    queryClient.setQueryData(QUERY_KEYS.me, otherUser);
    queryClient.setQueryData(QUERY_KEYS.collections, ['Collection de misty']);
    const { result } = renderHook(() => useLogin(), { wrapper });

    // Ce que fait le client API quand le renouvellement est refusé en cours d'usage.
    await act(() => authService.clearSession());
    await act(() => result.current.mutateAsync(CREDENTIALS));

    expect(queryClient.getQueryData(QUERY_KEYS.collections)).toBeUndefined();
    expect(queryClient.getQueryData(QUERY_KEYS.me)).toEqual(TEST_USER);
  });
});
