import { Injectable } from '@nestjs/common';
import { RecordAuditEntryUseCase } from '../../../audit/application/use-cases/RecordAuditEntryUseCase';
import type { IAccountErasureAudit } from '../../application/ports/IAccountErasureAudit';

/** `userId` is the account itself: it keeps pointing at the (anonymized) row until the entry expires. */
const TARGET_TYPE = 'user';

/** Writes the erasure trace through the audit module (no HTTP request is involved: a CronJob runs this). */
@Injectable()
export class AuditAccountErasureTrail implements IAccountErasureAudit {
  constructor(private readonly recordAuditEntry: RecordAuditEntryUseCase) {}

  async recordDeletionRequested(userId: string): Promise<void> {
    await this.recordAuditEntry.execute({
      userId,
      action: 'auth.account.deletion_requested',
      targetType: TARGET_TYPE,
      targetId: userId,
    });
  }

  async recordAnonymized(userId: string, scheduledFor: Date): Promise<void> {
    await this.recordAuditEntry.execute({
      userId,
      action: 'auth.account.anonymized',
      targetType: TARGET_TYPE,
      targetId: userId,
      metadata: { deletionScheduledFor: scheduledFor.toISOString() },
    });
  }
}
