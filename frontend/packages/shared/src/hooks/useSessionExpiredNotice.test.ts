import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createAuthHarness } from './mocks/createAuthHarness';
import { useSessionExpiredNotice } from './useSessionExpiredNotice';

describe('useSessionExpiredNotice', () => {
  it('signale l’expiration sur cet écran puis l’acquitte dans le store', () => {
    const { store, wrapper } = createAuthHarness();
    store.getState().endSession({ reason: 'expired' });

    const { result, rerender } = renderHook(() => useSessionExpiredNotice(), { wrapper });

    expect(result.current).toBe(true);
    expect(store.getState().endReason).toBeNull();
    rerender();
    expect(result.current).toBe(true);
  });

  it('garde le message sous StrictMode (double montage en développement)', () => {
    const { store, wrapper } = createAuthHarness();
    store.getState().endSession({ reason: 'expired' });
    let renders = 0;

    const { result, rerender } = renderHook(
      () => {
        renders += 1;
        return useSessionExpiredNotice();
      },
      { wrapper, reactStrictMode: true },
    );

    // Double rendu et double effet : l'acquittement du premier montage ne doit pas effacer le message.
    expect(renders).toBeGreaterThan(1);
    expect(result.current).toBe(true);
    expect(store.getState().endReason).toBeNull();
    rerender();
    expect(result.current).toBe(true);
  });

  it('ne signale rien après une déconnexion volontaire, et l’acquitte aussi', () => {
    const { store, wrapper } = createAuthHarness();
    store.getState().endSession({ reason: 'logout' });

    const { result } = renderHook(() => useSessionExpiredNotice(), { wrapper });

    expect(result.current).toBe(false);
    expect(store.getState().endReason).toBeNull();
  });

  it('ne signale rien à une visite suivante', () => {
    const { store, wrapper } = createAuthHarness();
    store.getState().endSession({ reason: 'expired' });
    renderHook(() => useSessionExpiredNotice(), { wrapper }).unmount();

    const { result } = renderHook(() => useSessionExpiredNotice(), { wrapper });

    expect(result.current).toBe(false);
  });
});
