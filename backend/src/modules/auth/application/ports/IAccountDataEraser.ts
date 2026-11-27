export const ACCOUNT_DATA_ERASER = 'ACCOUNT_DATA_ERASER';

/**
 * Application port: removes what an account owns, ahead of its anonymization (RGPD Art. 17, S04 §7:
 * "compte, historique d'utilisation et données de collection"). The account row itself is not touched
 * here — IUserRepository.save does that with `User.anonymize()`.
 */
export interface IAccountDataEraser {
  /**
   * Deletes the user's sessions and collections (with their card entries) and strips the email from
   * the audit metadata, in one transaction.
   * MUST be idempotent: it runs again when a previous attempt failed before the account was
   * anonymized, and an unknown user or one with nothing left to delete is a no-op, not an error.
   * Keeps the audit entries (their own legal retention period, S04 §5) but strips the personal data
   * they may carry (`metadata.email`): the account's row is anonymized, not deleted, so the database
   * trigger that does this on DELETE never fires.
   */
  eraseAccountData(userId: string): Promise<void>;
}
