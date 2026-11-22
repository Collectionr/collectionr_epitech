import { Inject, Injectable, Logger } from '@nestjs/common';
import { accountDeletionCutoff } from '../../domain/rules/AccountDeletionPolicy';
import { ACCOUNT_ERASURE_AUDIT } from '../ports/IAccountErasureAudit';
import type { IAccountErasureAudit } from '../ports/IAccountErasureAudit';
import { ACCOUNT_DATA_ERASER } from '../ports/IAccountDataEraser';
import type { IAccountDataEraser } from '../ports/IAccountDataEraser';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

/** Accounts handled by one run: a run is bounded, the next one picks up what is left. */
export const ANONYMIZATION_BATCH_SIZE = 100;

export interface AnonymizeDueAccountsResult {
  readonly anonymized: number;
  /** Accounts left for the next run (they stay due): see the log for why. */
  readonly failed: number;
}

/**
 * Anonymizes the accounts whose erasure was requested more than ACCOUNT_DELETION_GRACE_DAYS ago.
 * Nothing calls it on its own: the K3s CronJob of COLLR-544 does, like PurgeExpiredSessionsUseCase.
 *
 * For each account the data it owns is erased, the erasure is written to the audit trail
 * (IAccountErasureAudit: before the change, so a failed write stops it), and only then is the row anonymized. A failure between the two
 * leaves the account due, so the next run starts over (the eraser is idempotent); the other order
 * could leave the data of an account that is no longer due, and nothing would ever clean it up.
 * One failing account never stops the others.
 */
@Injectable()
export class AnonymizeDueAccountsUseCase {
  private readonly logger = new Logger(AnonymizeDueAccountsUseCase.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(ACCOUNT_DATA_ERASER) private readonly accountDataEraser: IAccountDataEraser,
    @Inject(ACCOUNT_ERASURE_AUDIT) private readonly erasureAudit: IAccountErasureAudit,
  ) {}

  async execute(now: Date = new Date()): Promise<AnonymizeDueAccountsResult> {
    const due = await this.userRepository.findDeletionDue(
      accountDeletionCutoff(now),
      ANONYMIZATION_BATCH_SIZE,
    );

    let anonymized = 0;
    let failed = 0;
    for (const user of due) {
      try {
        const anonymizedUser = user.anonymize(now);
        await this.accountDataEraser.eraseAccountData(user.id);
        await this.erasureAudit.recordAnonymized(user.id, user.deletedAt as Date);
        await this.userRepository.save(anonymizedUser);
        anonymized += 1;
      } catch (error) {
        failed += 1;
        // The id is a pseudonym; the message is not logged, it could carry what the driver echoes.
        this.logger.error(
          `Anonymization of account ${user.id} failed (${error instanceof Error ? error.name : 'unknown error'}), retried at the next run`,
        );
      }
    }
    return { anonymized, failed };
  }
}
