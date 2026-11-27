import { ANONYMIZATION_BATCH_SIZE } from '../modules/auth/application/use-cases/AnonymizeDueAccountsUseCase';
import type { AnonymizeDueAccountsResult } from '../modules/auth/application/use-cases/AnonymizeDueAccountsUseCase';

/** What a Kubernetes Job reads: 0 = succeeded, anything else = failed. */
export const JOB_EXIT_SUCCESS = 0;
export const JOB_EXIT_FAILURE = 1;

/** Bounds a run: whatever is left after that many batches waits for the next one. */
export const MAX_BATCHES_PER_RUN = 50;

export interface JobLogger {
  log(message: string): void;
  error(message: string): void;
}

/**
 * One run of the account purge: anonymizes every due account, batch after batch, and returns the
 * process exit code. Fails when at least one account could not be anonymized (it stays due, the next
 * run takes it again) or when the run could not happen at all.
 */
export async function runPurgeAccountsJob(
  purge: () => Promise<AnonymizeDueAccountsResult>,
  logger: JobLogger,
): Promise<number> {
  let anonymized = 0;
  let failed = 0;

  try {
    for (let batch = 0; batch < MAX_BATCHES_PER_RUN; batch += 1) {
      const result = await purge();
      anonymized += result.anonymized;
      failed += result.failed;

      // Only a full batch can leave accounts waiting. Without progress, the next one would be the
      // same failures again.
      const batchWasFull = result.anonymized + result.failed >= ANONYMIZATION_BATCH_SIZE;
      if (!batchWasFull || result.anonymized === 0) {
        break;
      }
    }
  } catch (error) {
    // Only the error's name: its message may echo what the database driver was given.
    logger.error(
      `Account purge could not run (${error instanceof Error ? error.name : 'unknown error'}), ` +
        `anonymized=${anonymized} before the failure`,
    );
    return JOB_EXIT_FAILURE;
  }

  const summary = `Account purge finished: anonymized=${anonymized} failed=${failed}`;
  if (failed > 0) {
    logger.error(summary);
    return JOB_EXIT_FAILURE;
  }
  logger.log(summary);
  return JOB_EXIT_SUCCESS;
}
