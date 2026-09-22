import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { AUDIT_METADATA_KEY } from '../decorators/Audit';
import type { AuditOptions } from '../decorators/Audit';
import { consumeAuditContext } from '../AuditRequestContext';
import { AuditContextGuard } from './AuditContextGuard';

function buildContext(request: unknown): ExecutionContext {
  const handler = (): void => undefined;
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function build(options: AuditOptions | undefined): AuditContextGuard {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'get')
    .mockImplementation((key) => (key === AUDIT_METADATA_KEY ? options : undefined));
  return new AuditContextGuard(reflector);
}

describe('AuditContextGuard', () => {
  it('always lets the request through', () => {
    const guard = build({ action: 'collection.create' });

    expect(guard.canActivate(buildContext({}))).toBe(true);
  });

  it('stashes the @Audit options on the request when present', () => {
    const options: AuditOptions = { action: 'collection.create' };
    const guard = build(options);
    const request = {};

    guard.canActivate(buildContext(request));

    expect(consumeAuditContext(request)).toBe(options);
  });

  it('stashes nothing on a route without @Audit', () => {
    const guard = build(undefined);
    const request = {};

    guard.canActivate(buildContext(request));

    expect(consumeAuditContext(request)).toBeUndefined();
  });
});
