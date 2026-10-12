import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from './JwtAuthGuard';

function buildContext(request: Partial<FastifyRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(principal: { userId: string; familyId: string } | null): {
  guard: JwtAuthGuard;
  verify: jest.Mock;
} {
  const verify = jest.fn().mockResolvedValue(principal);
  return { guard: new JwtAuthGuard({ verify }), verify };
}

describe('JwtAuthGuard', () => {
  it('authenticates a valid bearer token and exposes only the user id on request.user', async () => {
    const { guard, verify } = buildGuard({ userId: 'user-1', familyId: 'family-1' });
    const request: Partial<FastifyRequest> & { user?: unknown } = {
      headers: { authorization: 'Bearer a.valid.token' },
    };

    await expect(guard.canActivate(buildContext(request))).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('a.valid.token');
    expect(request.user).toEqual({ id: 'user-1' });
  });

  it.each(['bearer a.valid.token', 'BEARER a.valid.token', 'Bearer   a.valid.token'])(
    'accepts the scheme case-insensitively and tolerates extra spaces (RFC 7235): "%s"',
    async (header) => {
      const { guard, verify } = buildGuard({ userId: 'user-1', familyId: 'family-1' });

      await expect(
        guard.canActivate(buildContext({ headers: { authorization: header } })),
      ).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('a.valid.token');
    },
  );

  it.each([
    ['no Authorization header', undefined],
    ['a non-Bearer scheme', 'Basic abc123'],
    ['a Bearer scheme with no token', 'Bearer '],
    ['a bare token with no scheme', 'a.valid.token'],
    ['an absurdly long token', `Bearer ${'a'.repeat(10_000)}`],
  ])('rejects %s without asking the verifier', async (_label, header) => {
    const { guard, verify } = buildGuard({ userId: 'user-1', familyId: 'family-1' });

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: header } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a token the verifier does not accept (revoked, expired, refresh token, deactivated account...)', async () => {
    const { guard } = buildGuard(null);

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: 'Bearer revoked.token.here' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not say WHY a token was rejected', async () => {
    const { guard } = buildGuard(null);

    await expect(
      guard.canActivate(buildContext({ headers: { authorization: 'Bearer x.y.z' } })),
    ).rejects.toThrow('Invalid or expired access token');
  });
});
