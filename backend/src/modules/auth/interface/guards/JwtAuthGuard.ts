import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtTokenCodec } from '../../infrastructure/services/JwtTokenCodec';

const BEARER_PREFIX = 'Bearer ';

interface AccessTokenPayload {
  readonly sub: string;
}

/** Minimal shape the rest of the app relies on (e.g. audit's readActorId, ReadAuditContext.ts). */
export interface AuthenticatedUser {
  readonly id: string;
}

interface RequestWithUser extends FastifyRequest {
  user?: AuthenticatedUser;
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string' || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }
  return header.slice(BEARER_PREFIX.length);
}

/** Verifies the JWT access token and populates `request.user = { id }` for protected routes. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtTokenCodec: JwtTokenCodec) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);
    if (token === null) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = this.jwtTokenCodec.verify<AccessTokenPayload>(token);
      request.user = { id: payload.sub };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
