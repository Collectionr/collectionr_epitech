import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from './JwtAuthGuard';
import type { JwtTokenCodec } from '../../infrastructure/services/JwtTokenCodec';

function buildContext(request: Partial<FastifyRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('allows the request and populates request.user on a valid bearer token', () => {
    const verify = jest.fn().mockReturnValue({ sub: 'user-1' });
    const guard = new JwtAuthGuard({ verify } as unknown as JwtTokenCodec);
    const request: Partial<FastifyRequest> & { user?: unknown } = {
      headers: { authorization: 'Bearer a.valid.token' },
    };

    expect(guard.canActivate(buildContext(request))).toBe(true);
    expect(verify).toHaveBeenCalledWith('a.valid.token');
    expect(request.user).toEqual({ id: 'user-1' });
  });

  it('rejects a missing Authorization header', () => {
    const verify = jest.fn();
    const guard = new JwtAuthGuard({ verify } as unknown as JwtTokenCodec);

    expect(() => guard.canActivate(buildContext({ headers: {} }))).toThrow(UnauthorizedException);
    expect(verify).not.toHaveBeenCalled();
  });

  it('rejects a header that is not a Bearer token', () => {
    const verify = jest.fn();
    const guard = new JwtAuthGuard({ verify } as unknown as JwtTokenCodec);
    const request = { headers: { authorization: 'Basic abc123' } };

    expect(() => guard.canActivate(buildContext(request))).toThrow(UnauthorizedException);
  });

  it('rejects an invalid or expired token', () => {
    const verify = jest.fn(() => {
      throw new Error('jwt expired');
    });
    const guard = new JwtAuthGuard({ verify } as unknown as JwtTokenCodec);
    const request = { headers: { authorization: 'Bearer expired.token.here' } };

    expect(() => guard.canActivate(buildContext(request))).toThrow(UnauthorizedException);
  });
});
