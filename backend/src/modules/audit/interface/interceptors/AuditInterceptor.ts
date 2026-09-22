import { HttpException, Injectable, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, concatMap, from, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { RecordAuditEntryUseCase } from '../../application/use-cases/RecordAuditEntryUseCase';
import type { AuditMetadataValue } from '../../domain/entities/AuditEntry';
import { AUDIT_METADATA_KEY } from '../decorators/Audit';
import type { AuditOptions } from '../decorators/Audit';
import { consumeAuditContext } from '../AuditRequestContext';
import { writeAuditEntry } from '../WriteAuditEntry';
import type { AuditableRequest } from './ReadAuditContext';

const FAILURE_SUFFIX = '.failed';
const UNEXPECTED_ERROR_STATUS = 500;

/**
 * Records an audit entry for every handler annotated with @Audit; other routes
 * are untouched. The entry is written before the response is sent. A failed
 * write is logged as an error and never breaks the business request.
 *
 * Only covers success/handler failure: a rejection thrown by a *guard* never
 * reaches this interceptor (NestJS runs guards before interceptors exist for
 * a request) — that case is covered by AuditContextGuard + AllExceptionsFilter.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly recordAuditEntry: RecordAuditEntryUseCase,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditOptions | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );
    if (options === undefined) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditableRequest>();
    // Every guard passed: this path now owns the recording, so
    // AllExceptionsFilter must not also record it (see AuditRequestContext).
    consumeAuditContext(request);

    return next.handle().pipe(
      concatMap((response: unknown) =>
        from(this.write(request, options, options.action)).pipe(concatMap(() => [response])),
      ),
      catchError((error: unknown) =>
        from(
          this.write(request, options, `${options.action}${FAILURE_SUFFIX}`, {
            statusCode:
              error instanceof HttpException ? error.getStatus() : UNEXPECTED_ERROR_STATUS,
          }),
        ).pipe(concatMap(() => throwError(() => error))),
      ),
    );
  }

  private write(
    request: AuditableRequest,
    options: AuditOptions,
    action: string,
    extra: Readonly<Record<string, AuditMetadataValue>> = {},
  ): Promise<void> {
    return writeAuditEntry(
      { recordAuditEntry: this.recordAuditEntry, logger: this.logger },
      request,
      options,
      action,
      extra,
    );
  }
}
