import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAuthHarness, TEST_USER } from './mocks/createAuthHarness';
import { useRegister } from './useRegister';

describe('useRegister', () => {
  it('crée le compte sans ouvrir de session', async () => {
    const input = {
      email: 'ash@exemple.fr',
      password: 'pikachu25',
      username: 'ash',
      acceptedTermsVersion: '1',
    };
    const { client, store, wrapper } = createAuthHarness({
      '/auth/register': async () => TEST_USER,
    });
    const { result } = renderHook(() => useRegister(), { wrapper });

    await expect(act(() => result.current.mutateAsync(input))).resolves.toEqual(TEST_USER);

    expect(client.request).toHaveBeenCalledWith('/auth/register', { method: 'POST', body: input });
    expect(store.getState().status).toBe('unknown');
  });
});
