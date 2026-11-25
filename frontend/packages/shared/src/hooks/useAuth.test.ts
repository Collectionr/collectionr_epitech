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

    expect(result.current).toMatchObject({ status: 'unknown', user: null, sessionExpired: false });

    act(() => store.getState().startSession(TEST_USER, 'acces-1'));
    expect(result.current).toMatchObject({ status: 'authenticated', user: TEST_USER });

    act(() => store.getState().endSession());
    expect(result.current).toMatchObject({ status: 'anonymous', user: null });
  });

  it('signale une session expirée jusqu’à son acquittement', () => {
    const { store, wrapper } = createAuthHarness();
    store.getState().endSession({ expired: true });
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.sessionExpired).toBe(true);
    act(() => result.current.acknowledgeSessionExpiry());

    expect(result.current.sessionExpired).toBe(false);
  });

  it('exige le service d’authentification à la racine', () => {
    // React journalise l'erreur levée pendant le rendu : bruit attendu. `console` est lu sur
    // globalThis, packages/shared compilant sans les types DOM et Node.
    const runtime = globalThis as unknown as { console: { error: (...data: unknown[]) => void } };
    vi.spyOn(runtime.console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow('AuthServiceContext absent');
  });
});
