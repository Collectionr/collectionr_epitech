import { ForbiddenException, Logger } from '@nestjs/common';
import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { lastValueFrom, of, throwError } from 'rxjs';
import type { RecordAuditEntryUseCase } from '../../application/use-cases/RecordAuditEntryUseCase';
import { AUDIT_METADATA_KEY } from '../decorators/Audit';
import type { AuditOptions } from '../decorators/Audit';
import { consumeAuditContext, stashAuditContext } from '../AuditRequestContext';
import { AuditInterceptor } from './AuditInterceptor';

const USER_ID = '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e';
const TARGET_ID = '7d444840-9dc0-41d5-bf4a-0e4c0b5c1e11';

function buildContext(request: unknown): ExecutionContext {
  const handler = (): void => undefined;
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function build(options: AuditOptions | undefined, execute: jest.Mock) {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'get')
    .mockImplementation((key) => (key === AUDIT_METADATA_KEY ? options : undefined));
  return new AuditInterceptor(reflector, { execute } as unknown as RecordAuditEntryUseCase);
}

const request = {
  id: 'req-1',
  user: { id: USER_ID },
  params: { id: TARGET_ID },
  body: { name: 'Base Set', password: 'hunter2' },
};

describe('AuditInterceptor', () => {
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing on a route without @Audit', async () => {
    const execute = jest.fn();
    const interceptor = build(undefined, execute);

    const result = await lastValueFrom(
      interceptor.intercept(buildContext(request), { handle: () => of('body') } as CallHandler),
    );

    expect(result).toBe('body');
    expect(execute).not.toHaveBeenCalled();
  });

  it('records the action after a successful handler and returns the response untouched', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const interceptor = build(
      {
        action: 'collection.update',
        targetType: 'collection',
        targetIdParam: 'id',
        bodyFields: ['name'],
      },
      execute,
    );

    const result = await lastValueFrom(
      interceptor.intercept(buildContext(request), { handle: () => of({ ok: true }) }),
    );

    expect(result).toEqual({ ok: true });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({
      userId: USER_ID,
      action: 'collection.update',
      targetType: 'collection',
      targetId: TARGET_ID,
      metadata: { requestId: 'req-1', name: 'Base Set' },
    });
  });

  it('never stores a field that was not explicitly allowed (password)', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const interceptor = build({ action: 'user.update', bodyFields: ['name'] }, execute);

    await lastValueFrom(interceptor.intercept(buildContext(request), { handle: () => of(null) }));

    expect(JSON.stringify(execute.mock.calls)).not.toContain('hunter2');
    expect(JSON.stringify(execute.mock.calls)).not.toContain('password');
  });

  it('records a .failed action with the status code and rethrows the original error', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const interceptor = build({ action: 'collection.delete' }, execute);
    const error = new ForbiddenException('nope');

    await expect(
      lastValueFrom(
        interceptor.intercept(buildContext(request), { handle: () => throwError(() => error) }),
      ),
    ).rejects.toBe(error);

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'collection.delete.failed',
        metadata: { requestId: 'req-1', statusCode: 403 },
      }),
    );
  });

  it('records a status code of 500 for an unexpected error', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const interceptor = build({ action: 'collection.delete' }, execute);

    await expect(
      lastValueFrom(
        interceptor.intercept(buildContext(request), {
          handle: () => throwError(() => new Error('boom')),
        }),
      ),
    ).rejects.toThrow('boom');

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { requestId: 'req-1', statusCode: 500 } }),
    );
  });

  it('records an anonymous actor when nobody is authenticated', async () => {
    const execute = jest.fn().mockResolvedValue(undefined);
    const interceptor = build({ action: 'auth.login' }, execute);

    await lastValueFrom(interceptor.intercept(buildContext({}), { handle: () => of(null) }));

    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, targetId: null, metadata: null }),
    );
  });

  it('logs a failed audit write without breaking the business request', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('db down'));
    const interceptor = build({ action: 'collection.create' }, execute);

    const result = await lastValueFrom(
      interceptor.intercept(buildContext(request), { handle: () => of({ id: 1 }) }),
    );

    expect(result).toEqual({ id: 1 });
    expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('db down'));
  });

  it('consumes the context stashed by AuditContextGuard so AllExceptionsFilter never double-records', async () => {
    const options: AuditOptions = { action: 'collection.create' };
    const interceptor = build(options, jest.fn().mockResolvedValue(undefined));
    const auditedRequest = { ...request };
    stashAuditContext(auditedRequest, options);

    await lastValueFrom(
      interceptor.intercept(buildContext(auditedRequest), { handle: () => of(null) }),
    );

    expect(consumeAuditContext(auditedRequest)).toBeUndefined();
  });

  it('still rethrows the business error when the audit write also fails', async () => {
    const execute = jest.fn().mockRejectedValue(new Error('db down'));
    const interceptor = build({ action: 'collection.create' }, execute);
    const error = new ForbiddenException();

    await expect(
      lastValueFrom(
        interceptor.intercept(buildContext(request), { handle: () => throwError(() => error) }),
      ),
    ).rejects.toBe(error);
    expect(loggerError).toHaveBeenCalled();
  });
});
