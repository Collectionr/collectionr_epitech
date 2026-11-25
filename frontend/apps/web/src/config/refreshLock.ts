import type { RunExclusive } from '@shared/services';

/** Nom du verrou partagé par les onglets de l'application pendant un renouvellement de session. */
export const REFRESH_LOCK_NAME = 'collectionr-auth-refresh';

/** Sous-ensemble de `LockManager` (Web Locks) utilisé. */
export interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/**
 * Exclusion entre onglets pour le renouvellement : deux onglets ne présentent jamais le même jeton
 * de renouvellement, à usage unique. Sans Web Locks (navigateur ancien), exécution directe.
 * @param locks - `navigator.locks`, éventuellement absent
 */
export function createRunExclusive(locks: LockManagerLike | undefined): RunExclusive {
  if (!locks) {
    return (task) => task();
  }
  return (task) => locks.request(REFRESH_LOCK_NAME, task);
}
