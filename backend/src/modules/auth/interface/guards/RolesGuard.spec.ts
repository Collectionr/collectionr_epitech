import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import type { RoleName } from '../../../../shared/config/AppConstants';
import type { IUserRoleResolver } from '../../application/ports/IUserRoleResolver';
import { RolesGuard } from './RolesGuard';

const USER_ID = '0b1f6c1e-6c1e-4b1e-8b1e-1b1e6c1e4b1e';

interface Harness {
  guard: RolesGuard;
  getAllAndOverride: jest.Mock;
  roleOf: jest.Mock;
}

function build(): Harness {
  const getAllAndOverride = jest.fn();
  const roleOf = jest.fn();
  const reflector = { getAllAndOverride } as unknown as Reflector;
  const roleResolver: IUserRoleResolver = { roleOf };
  return { guard: new RolesGuard(reflector, roleResolver), getAllAndOverride, roleOf };
}

function contextWith(user: { id: string } | undefined): ExecutionContext {
  const request = { user };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('refuses a route that declares no role at all (fail closed, even for an authenticated user)', async () => {
    const h = build();
    h.getAllAndOverride.mockReturnValue(undefined);

    await expect(h.guard.canActivate(contextWith({ id: USER_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(h.roleOf).not.toHaveBeenCalled();
  });

  it('refuses a request that never went through JwtAuthGuard (no authenticated user)', async () => {
    const h = build();
    h.getAllAndOverride.mockReturnValue(['ADMIN']);

    await expect(h.guard.canActivate(contextWith(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(h.roleOf).not.toHaveBeenCalled();
  });

  it('lets a user through when their stored role is one of the required roles', async () => {
    const h = build();
    h.getAllAndOverride.mockReturnValue(['ADMIN']);
    h.roleOf.mockResolvedValue('ADMIN' satisfies RoleName);

    await expect(h.guard.canActivate(contextWith({ id: USER_ID }))).resolves.toBe(true);
    expect(h.roleOf).toHaveBeenCalledWith(USER_ID);
  });

  it('refuses a user whose stored role is not among the required roles', async () => {
    const h = build();
    h.getAllAndOverride.mockReturnValue(['ADMIN']);
    h.roleOf.mockResolvedValue('USER' satisfies RoleName);

    await expect(h.guard.canActivate(contextWith({ id: USER_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses a user with no known role (the resolver returned null)', async () => {
    const h = build();
    h.getAllAndOverride.mockReturnValue(['USER', 'ADMIN']);
    h.roleOf.mockResolvedValue(null);

    await expect(h.guard.canActivate(contextWith({ id: USER_ID }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
