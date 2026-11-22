/**
 * Days between an erasure request and the anonymization of the account (RGPD Art. 17, S04 §7:
 * "dans un délai maximum de 30 jours"). A legal deadline, not a tuning knob: fixed here rather than
 * read from the environment, so no deployment can quietly lengthen it.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** When an erasure requested at `requestedAt` becomes due. */
export function accountDeletionDueAt(requestedAt: Date): Date {
  return new Date(requestedAt.getTime() + ACCOUNT_DELETION_GRACE_DAYS * MILLISECONDS_PER_DAY);
}

/**
 * The newest `deletedAt` that is due at `now`: an account whose erasure was requested at or before
 * this instant has used up its grace period.
 */
export function accountDeletionCutoff(now: Date): Date {
  return new Date(now.getTime() - ACCOUNT_DELETION_GRACE_DAYS * MILLISECONDS_PER_DAY);
}
