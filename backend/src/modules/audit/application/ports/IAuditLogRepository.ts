import type { AuditEntry } from '../../domain/entities/AuditEntry';

export const AUDIT_LOG_REPOSITORY = 'AUDIT_LOG_REPOSITORY';

/** Append-only: the audit trail is never updated nor deleted by the application flow. */
export interface IAuditLogRepository {
  record(entry: AuditEntry): Promise<void>;
}
