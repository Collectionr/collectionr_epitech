import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAuthHarness, TEST_USER } from './mocks/createAuthHarness';
import { useAuth } from './useAuth';

describe('useAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflète la session et suit ses changements', () => {
    const { store, wrapper } = createAuthHarness();
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current).toEqual({
      status: 'unknown',
      user: null,
      endReason: null,
      restoreError: null,
    });

    act(() => store.getState().startSession(TEST_USER, 'acces-1'));
    expect(result.current).toMatchObject({ status: 'authenticated', user: TEST_USER });

    act(() => store.getState().endSession({ reason: 'logout' }));
    expect(result.current).toMatchObject({ status: 'anonymous', user: null, endReason: 'logout' });
  });

  it('expose l’erreur de restauration', () => {
    const { store, wrapper } = createAuthHarness();
    const error = new Error('Serveur injoignable');
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => store.getState().failRestore(error));

    expect(result.current).toMatchObject({ status: 'unknown', restoreError: error });
  });

  it('exige le service d’authentification à la racine', () => {
    // React journalise l'erreur levée pendant le rendu : bruit attendu. `console` est lu sur
    // globalThis, packages/shared compilant sans les types DOM et Node.
    const runtime = globalThis as unknown as { console: { error: (...data: unknown[]) => void } };
    vi.spyOn(runtime.console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow('AuthServiceContext absent');
  });
});
