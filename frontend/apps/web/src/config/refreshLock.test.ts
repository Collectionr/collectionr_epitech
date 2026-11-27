import { describe, expect, it, vi } from 'vitest';

import { createRunExclusive, REFRESH_LOCK_NAME } from './refreshLock';
import type { LockManagerLike } from './refreshLock';

describe('createRunExclusive', () => {
  it('exécute la tâche sous le verrou partagé par les onglets', async () => {
    const locks: LockManagerLike = {
      request: vi.fn((_name, callback) => callback()),
    };

    await expect(createRunExclusive(locks)(async () => 'nouveau jeton')).resolves.toBe(
      'nouveau jeton',
    );
    expect(locks.request).toHaveBeenCalledWith(REFRESH_LOCK_NAME, expect.any(Function));
  });

  it('exécute la tâche directement sans Web Locks', async () => {
    await expect(createRunExclusive(undefined)(async () => 'nouveau jeton')).resolves.toBe(
      'nouveau jeton',
    );
  });
});
