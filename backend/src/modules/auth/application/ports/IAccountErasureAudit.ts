export const ACCOUNT_ERASURE_AUDIT = 'ACCOUNT_ERASURE_AUDIT';

/**
 * Application port: leaves a trace of the erasure of an account in the audit trail (CDC §3.5: the
 * deletion of an account is a sensitive action). The trace carries ids and dates, never the personal
 * data being erased.
 *
 * Callers write it BEFORE the change it describes. A failed write then stops the change, which the
 * next attempt redoes; the other order could erase an account and leave nothing behind. The price is
 * a possible duplicate entry when the change itself fails afterwards and is retried.
 */
export interface IAccountErasureAudit {
  /** The user asked for the erasure of their account (the grace period starts). */
  recordDeletionRequested(userId: string): Promise<void>;

  /** The account is about to be anonymized once its grace period is over. */
  recordAnonymized(userId: string, deletionRequestedAt: Date): Promise<void>;
}
