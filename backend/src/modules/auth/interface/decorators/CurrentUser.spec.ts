import type { ExecutionContext } from '@nestjs/common';
import { readCurrentUser } from './CurrentUser';

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('readCurrentUser', () => {
  it('returns the user populated by JwtAuthGuard', () => {
    const context = buildContext({ user: { id: 'user-1' } });

    expect(readCurrentUser(context)).toEqual({ id: 'user-1' });
  });

  it('throws when no JwtAuthGuard has run', () => {
    const context = buildContext({});

    expect(() => readCurrentUser(context)).toThrow(
      '@CurrentUser() used on a route without JwtAuthGuard',
    );
  });
});
