import { describe, expect, it } from 'vitest';

import { resolveApiMocks } from './apiMocks';

describe('resolveApiMocks', () => {
  it.each([undefined, ''])('ne simule rien sans réglage (%j)', (value) => {
    expect(resolveApiMocks(value)).toBeNull();
  });

  it.each(['catalogue', 'all'] as const)('accepte le mode %s', (mode) => {
    expect(resolveApiMocks(mode)).toBe(mode);
  });

  it.each(['true', 'ALL', 'collections'])('refuse une valeur inconnue (%s)', (value) => {
    expect(() => resolveApiMocks(value)).toThrow(
      `VITE_API_MOCKS doit être vide ou valoir catalogue ou all (reçu : "${value}")`,
    );
  });
});
