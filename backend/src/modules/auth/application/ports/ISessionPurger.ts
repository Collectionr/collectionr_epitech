export const SESSION_PURGER = 'SESSION_PURGER';

/**
 * Application port: housekeeping of the session store. Nothing deletes sessions on its own;
 * whoever schedules it (K3s CronJob, see project_state.md "Purge des logs d'audit") calls the use case.
 */
export interface ISessionPurger {
  /**
   * Deletes the sessions whose refresh token can no longer be presented because it expired before
   * `cutoff`. A revoked-but-unexpired session is kept: it is what lets a replayed, already-rotated
   * token be recognised as stolen. Returns the number of deleted sessions.
   */
  purgeExpiredSessions(cutoff: Date): Promise<number>;
}
