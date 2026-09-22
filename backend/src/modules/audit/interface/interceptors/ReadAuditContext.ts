import type { AuditMetadata, AuditMetadataValue } from '../../domain/entities/AuditEntry';
import type { AuditOptions } from '../decorators/Audit';

/** The parts of the HTTP request the audit needs, without depending on the HTTP adapter. */
export interface AuditableRequest {
  readonly id?: unknown;
  readonly params?: unknown;
  readonly body?: unknown;
  /** Populated by the authentication layer (COLLR-442); absent until then. */
  readonly user?: unknown;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Defense in depth on top of @Audit's bodyFields allowlist (S05 §6): even a
// field whose *name* was not caught by SensitiveFields is redacted here if
// its *value* is shaped like a secret. Deliberately narrow (JWT / password
// hash shapes only) to avoid false positives on legitimate business data.
const JWT_SHAPE_PATTERN = /^[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}$/;
const HASH_PREFIX_PATTERN = /^\$(2[aby]|argon2(id?)?)\$/;
const REDACTED_VALUE = '[redacted]';

function looksLikeSecretValue(value: string): boolean {
  return JWT_SHAPE_PATTERN.test(value) || HASH_PREFIX_PATTERN.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asUuid(value: unknown): string | null {
  return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
}

export function readActorId(request: AuditableRequest): string | null {
  return isRecord(request.user) ? asUuid(request.user.id) : null;
}

export function readTargetId(request: AuditableRequest, options: AuditOptions): string | null {
  if (options.targetIdParam === undefined || !isRecord(request.params)) {
    return null;
  }
  return asUuid(request.params[options.targetIdParam]);
}

function toMetadataValue(value: unknown): AuditMetadataValue | undefined {
  if (typeof value === 'string') {
    return looksLikeSecretValue(value) ? REDACTED_VALUE : value;
  }
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    return value.flatMap((item: unknown) => {
      const converted = toMetadataValue(item);
      return converted === undefined ? [] : [converted];
    });
  }
  if (isRecord(value)) {
    const converted: Record<string, AuditMetadataValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const convertedItem = toMetadataValue(item);
      if (convertedItem !== undefined) {
        converted[key] = convertedItem;
      }
    }
    return converted;
  }
  return undefined;
}

/**
 * Builds the entry metadata: only the body fields explicitly allowed by
 * @Audit are copied, plus the request id for log correlation (S05 §3.1).
 */
export function buildMetadata(
  request: AuditableRequest,
  options: AuditOptions,
  extra: Readonly<Record<string, AuditMetadataValue>> = {},
): AuditMetadata | null {
  const metadata: Record<string, AuditMetadataValue> = { ...extra };

  if (typeof request.id === 'string') {
    metadata.requestId = request.id;
  }

  if (isRecord(request.body)) {
    for (const field of options.bodyFields ?? []) {
      const converted = toMetadataValue(request.body[field]);
      if (converted !== undefined) {
        metadata[field] = converted;
      }
    }
  }

  return Object.keys(metadata).length > 0 ? metadata : null;
}
