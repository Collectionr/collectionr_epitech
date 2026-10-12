import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { ACCESS_TOKEN_VERIFIER } from '../../application/ports/IAccessTokenVerifier';
import type { IAccessTokenVerifier } from '../../application/ports/IAccessTokenVerifier';

/** RFC 7235: the auth scheme is case-insensitive and separated from the credentials by 1+ spaces. */
const BEARER_PATTERN = /^bearer +(\S+)$/i;

/** A real access token is ~350 bytes; anything this large is not worth parsing. */
const MAX_TOKEN_LENGTH = 4096;

/** Minimal shape the rest of the app relies on (e.g. audit's readActorId, ReadAuditContext.ts). */
export interface AuthenticatedUser {
  readonly id: string;
}

interface RequestWithUser extends FastifyRequest {
  user?: AuthenticatedUser;
}

function extractBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (typeof header !== 'string') {
    return null;
  }
  const token = BEARER_PATTERN.exec(header)?.[1];
  return token !== undefined && token.length <= MAX_TOKEN_LENGTH ? token : null;
}

/**
 * Authenticates a request from its bearer access token and populates `request.user = { id }`.
 * What "valid" means (kind of token, revoked session, deactivated account...) is decided by the
 * IAccessTokenVerifier port, not here: this guard only parses the header.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(ACCESS_TOKEN_VERIFIER) private readonly accessTokenVerifier: IAccessTokenVerifier,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const token = extractBearerToken(request);
    if (token === null) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const principal = await this.accessTokenVerifier.verify(token);
    if (principal === null) {
      // One message for every reason: a client learns nothing about which check failed.
      throw new UnauthorizedException('Invalid or expired access token');
    }

    request.user = { id: principal.userId };
    return true;
  }
}
