import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import { AuditEntry } from '../../domain/entities/AuditEntry';
import { isSensitiveFieldName } from '../../domain/rules/SensitiveFields';

export const AUDIT_METADATA_KEY = 'audit:options';

export interface AuditOptions {
  /** `domain.verb` (e.g. collection.create). A failure is recorded as `<action>.failed`. */
  readonly action: string;
  /** Kind of the entity the action targets (e.g. collection). */
  readonly targetType?: string;
  /** Route parameter holding the target id; kept only when it is a UUID. */
  readonly targetIdParam?: string;
  /** Request body fields copied into `metadata` — an explicit allowlist, the body is never stored as-is. */
  readonly bodyFields?: readonly string[];
}

/**
 * Marks a route handler as audited: AuditInterceptor records an entry once the
 * handler has succeeded or failed. Misconfiguration throws at startup.
 *
 * Limit: interceptors run after guards, so a request rejected by a guard
 * (401/403/429) never reaches this decorator and is not recorded by it.
 */
export function Audit(options: AuditOptions): CustomDecorator<string> {
  if (!AuditEntry.isValidAction(options.action)) {
    throw new Error(
      `@Audit: invalid action "${options.action}", expected the "domain.verb" format`,
    );
  }

  const sensitiveField = options.bodyFields?.find(isSensitiveFieldName);
  if (sensitiveField !== undefined) {
    throw new Error(
      `@Audit(${options.action}): the body field "${sensitiveField}" is sensitive and must not be audited`,
    );
  }

  return SetMetadata(AUDIT_METADATA_KEY, options);
}
