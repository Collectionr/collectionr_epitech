import type { AuditOptions } from './decorators/Audit';

interface RequestWithAuditContext {
  auditContext?: AuditOptions;
}

/**
 * Stashes the @Audit options on the request object itself. This is the only
 * way to carry them from a guard (which runs before AuditInterceptor even
 * exists for this request) to AllExceptionsFilter, which is the sole place
 * able to observe a rejection thrown by a *later* guard — see AuditContextGuard.
 */
export function stashAuditContext(request: unknown, options: AuditOptions): void {
  (request as RequestWithAuditContext).auditContext = options;
}

/**
 * Reads and clears the stashed options in the same step, so the context is
 * consumed at most once: AuditInterceptor consumes it (and discards it) as
 * soon as it runs, so AllExceptionsFilter only ever sees it for a request
 * that never reached the interceptor (a guard rejected it first).
 */
export function consumeAuditContext(request: unknown): AuditOptions | undefined {
  const typedRequest = request as RequestWithAuditContext;
  const options = typedRequest.auditContext;
  delete typedRequest.auditContext;
  return options;
}

/**
 * What the handler learns while running and a route-level `@Audit` cannot declare: who acted (login
 * and register run before anyone is authenticated), which entity was targeted when it is not a route
 * parameter, and metadata that must be derived (e.g. a canonical, truncated email) rather than
 * copied verbatim from the body. The audit writer reads it when it records the entry.
 */
export interface AuditSubject {
  readonly actorId?: string;
  readonly targetId?: string;
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

interface RequestWithAuditSubject {
  auditSubject?: AuditSubject;
}

/** Successive calls add up: actor/target are replaced when given, metadata keys are merged. */
export function setAuditSubject(request: unknown, subject: AuditSubject): void {
  const typedRequest = request as RequestWithAuditSubject;
  const current = typedRequest.auditSubject ?? {};
  typedRequest.auditSubject = {
    ...current,
    ...subject,
    metadata: { ...current.metadata, ...subject.metadata },
  };
  if (
    typedRequest.auditSubject.metadata &&
    Object.keys(typedRequest.auditSubject.metadata).length === 0
  ) {
    delete (typedRequest.auditSubject as { metadata?: unknown }).metadata;
  }
}

export function readAuditSubject(request: unknown): AuditSubject {
  const subject = (request as RequestWithAuditSubject).auditSubject;
  return typeof subject === 'object' && subject !== null ? subject : {};
}
