import { Inject, Injectable } from '@nestjs/common';
import { AuditEntry } from '../../domain/entities/AuditEntry';
import type { AuditMetadata } from '../../domain/entities/AuditEntry';
import { AUDIT_LOG_REPOSITORY } from '../ports/IAuditLogRepository';
import type { IAuditLogRepository } from '../ports/IAuditLogRepository';
import { AUDIT_RETENTION_DAYS } from '../ports/AuditRetention';

export interface RecordAuditEntryInput {
  readonly userId?: string | null;
  readonly action: string;
  readonly targetType?: string | null;
  readonly targetId?: string | null;
  readonly metadata?: AuditMetadata | null;
}

/**
 * Entry point for any domain that needs to leave an audit trace, with or
 * without the @Audit decorator. Errors are propagated: whether a failed write
 * blocks the caller is the caller's decision.
 */
@Injectable()
export class RecordAuditEntryUseCase {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY) private readonly auditLogRepository: IAuditLogRepository,
    @Inject(AUDIT_RETENTION_DAYS) private readonly retentionDays: number,
  ) {}

  async execute(input: RecordAuditEntryInput): Promise<void> {
    const entry = AuditEntry.record({
      userId: input.userId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: input.metadata ?? null,
      occurredAt: new Date(),
      retentionDays: this.retentionDays,
    });

    await this.auditLogRepository.record(entry);
  }
}
