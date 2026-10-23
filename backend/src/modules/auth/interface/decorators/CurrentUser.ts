import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../guards/JwtAuthGuard';

interface RequestWithUser {
  user?: AuthenticatedUser;
}

// Exported separately (rather than inlined in createParamDecorator) so it can be unit-tested
// directly with a fake ExecutionContext — see CurrentUser.spec.ts.
export function readCurrentUser(context: ExecutionContext): AuthenticatedUser {
  const request = context.switchToHttp().getRequest<RequestWithUser>();
  if (request.user === undefined) {
    throw new Error('@CurrentUser() used on a route without JwtAuthGuard');
  }
  return request.user;
}

/** Reads the user populated by JwtAuthGuard — only valid on a route guarded by it. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => readCurrentUser(context),
);
