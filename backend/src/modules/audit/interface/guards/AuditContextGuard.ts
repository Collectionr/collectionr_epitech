import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUDIT_METADATA_KEY } from '../decorators/Audit';
import type { AuditOptions } from '../decorators/Audit';
import { stashAuditContext } from '../AuditRequestContext';

/**
 * Observes every request and stashes the @Audit options on it when the route
 * carries them — it never blocks anything itself.
 *
 * Must run before every other guard (wired first in AppModule, see the
 * comment there): NestJS interceptors never run when a *later* guard
 * rejects a request, so AuditInterceptor alone cannot record that
 * rejection. Stashing the context here lets AllExceptionsFilter record it
 * instead (ADR-011) — it is the only place downstream of every guard.
 */
@Injectable()
export class AuditContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const options = this.reflector.get<AuditOptions | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );
    if (options !== undefined) {
      stashAuditContext(context.switchToHttp().getRequest(), options);
    }
    return true;
  }
}
