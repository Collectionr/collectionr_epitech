/**
 * Days between the deactivation of an account at its holder's request and its anonymization (RGPD
 * Art. 17, S04 §7: "dans un délai maximum de 30 jours"). A legal deadline, not a tuning knob: fixed here
 * rather than read from the environment, so no deployment can quietly lengthen it.
 */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The date from which an account deactivated at `deactivatedAt` is purged, stored in `users.deletedAt`
 * (COLLR-544): 00:00 UTC, 30 dates later.
 *
 * Counted in calendar days, the time of day is ignored: deactivated on the 1st, at any hour, means due
 * from the start of day 1 + 30. Counting 30 x 24 h would leave an account deactivated in the afternoon
 * for the following day's run of a daily job, past the 30 days. Dates are UTC, so the result depends
 * neither on the machine's time zone nor on daylight saving time.
 */
export function accountDeletionDueAt(deactivatedAt: Date): Date {
  const startOfDay = Date.UTC(
    deactivatedAt.getUTCFullYear(),
    deactivatedAt.getUTCMonth(),
    deactivatedAt.getUTCDate(),
  );
  return new Date(startOfDay + ACCOUNT_DELETION_GRACE_DAYS * MILLISECONDS_PER_DAY);
}
