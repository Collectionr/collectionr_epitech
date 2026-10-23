import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import type { RoleName } from '../../../../shared/config/AppConstants';
import { USER_ROLE_RESOLVER } from '../../application/ports/IUserRoleResolver';
import type { IUserRoleResolver } from '../../application/ports/IUserRoleResolver';
import { REQUIRED_ROLES_METADATA_KEY } from '../decorators/RequireRole';
import type { AuthenticatedUser } from './JwtAuthGuard';

interface RequestWithUser extends FastifyRequest {
  user?: AuthenticatedUser;
}

/**
 * Checks the role of an authenticated user against @RequireRole (ADR-013). Fails closed at every
 * step: no requirement declared, no authenticated user, unknown role, or a role not required all
 * refuse the request. Runs after JwtAuthGuard, which is what sets `request.user`.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_ROLE_RESOLVER) private readonly roleResolver: IUserRoleResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<RoleName[] | undefined>(
      REQUIRED_ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles === undefined) {
      throw new ForbiddenException('No role is allowed on this route');
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    if (request.user === undefined) {
      // JwtAuthGuard did not run first: nobody is authenticated, so nothing can be checked.
      throw new UnauthorizedException('Missing authentication');
    }

    const role = await this.roleResolver.roleOf(request.user.id);
    if (role === null || !requiredRoles.includes(role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
