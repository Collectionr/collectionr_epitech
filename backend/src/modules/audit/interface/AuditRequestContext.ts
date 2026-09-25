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
