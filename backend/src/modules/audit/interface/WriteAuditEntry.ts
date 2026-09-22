import type { Logger } from '@nestjs/common';
import type { RecordAuditEntryUseCase } from '../application/use-cases/RecordAuditEntryUseCase';
import type { AuditMetadataValue } from '../domain/entities/AuditEntry';
import type { AuditOptions } from './decorators/Audit';
import { buildMetadata, readActorId, readTargetId } from './interceptors/ReadAuditContext';
import type { AuditableRequest } from './interceptors/ReadAuditContext';

export interface AuditWriteDeps {
  readonly recordAuditEntry: RecordAuditEntryUseCase;
  readonly logger: Logger;
}

/**
 * Builds and writes a single audit entry from a request + @Audit options.
 * Shared by AuditInterceptor (success/handler failure) and AllExceptionsFilter
 * (a guard rejected the request before the interceptor ever ran) so both
 * paths keep exactly the same fail-open behaviour: a write failure is logged
 * and never propagated (ADR-011).
 */
export async function writeAuditEntry(
  deps: AuditWriteDeps,
  request: AuditableRequest,
  options: AuditOptions,
  action: string,
  extra: Readonly<Record<string, AuditMetadataValue>> = {},
): Promise<void> {
  try {
    await deps.recordAuditEntry.execute({
      userId: readActorId(request),
      action,
      targetType: options.targetType ?? null,
      targetId: readTargetId(request, options),
      metadata: buildMetadata(request, options, extra),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    deps.logger.error(`Failed to record audit entry "${action}": ${reason}`);
  }
}
