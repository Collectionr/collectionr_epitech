import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../../../generated/prisma/client.js';
import { InvalidRefreshTokenError } from '../../application/errors/AuthErrors';
import type { AuthTokenPair, IAuthTokenService } from '../../application/ports/IAuthTokenService';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { JwtTokenCodec } from './JwtTokenCodec';

/** Injection token: access token lifetime, in seconds (JWT_ACCESS_TOKEN_TTL_SECONDS). */
export const ACCESS_TOKEN_TTL_SECONDS = 'ACCESS_TOKEN_TTL_SECONDS';
/** Injection token: refresh token / session lifetime, in seconds (JWT_REFRESH_TOKEN_TTL_SECONDS). */
export const REFRESH_TOKEN_TTL_SECONDS = 'REFRESH_TOKEN_TTL_SECONDS';

interface AccessTokenPayload {
  readonly sub: string;
}

interface RefreshTokenPayload {
  readonly sub: string;
  /** Also the `sessions` row id — a single DB lookup by primary key, no hash scan needed. */
  readonly jti: string;
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * IAuthTokenService implementation: JWT access/refresh tokens (jsonwebtoken, via JwtTokenCodec),
 * refresh sessions persisted in PostgreSQL (`sessions` table, docs/database/schema-sql.md SESSION).
 * A refresh token's `jti` claim is the session row id; `refreshTokenHash` (sha256) is defense in
 * depth only, so a DB-only leak (without JWT_SECRET) cannot be replayed as a valid token.
 */
@Injectable()
export class JwtAuthTokenService implements IAuthTokenService {
  constructor(
    private readonly jwtTokenCodec: JwtTokenCodec,
    @Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient,
    @Inject(ACCESS_TOKEN_TTL_SECONDS) private readonly accessTokenTtlSeconds: number,
    @Inject(REFRESH_TOKEN_TTL_SECONDS) private readonly refreshTokenTtlSeconds: number,
  ) {}

  async issueTokenPair(userId: string): Promise<AuthTokenPair> {
    return this.issuePairForSession(userId, randomUUID());
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokenPair> {
    const payload = this.verifyRefreshToken(refreshToken);
    const session = await this.prismaClient.session.findUnique({ where: { id: payload.jti } });

    if (
      session === null ||
      session.isRevoked ||
      session.userId !== payload.sub ||
      session.expiresAt.getTime() <= Date.now() ||
      session.refreshTokenHash !== hashToken(refreshToken)
    ) {
      throw new InvalidRefreshTokenError();
    }

    // Single use: the presented token is burned even if issuing the new pair fails below.
    await this.prismaClient.session.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    return this.issuePairForSession(payload.sub, randomUUID());
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.verifyRefreshToken(refreshToken);
    } catch {
      // Unknown, malformed or expired token: revoking it must not throw (port contract).
      return;
    }

    await this.prismaClient.session.updateMany({
      where: { id: payload.jti, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  private async issuePairForSession(userId: string, sessionId: string): Promise<AuthTokenPair> {
    const accessToken = this.jwtTokenCodec.sign(
      { sub: userId } satisfies AccessTokenPayload,
      this.accessTokenTtlSeconds,
    );
    const refreshToken = this.jwtTokenCodec.sign(
      { sub: userId, jti: sessionId } satisfies RefreshTokenPayload,
      this.refreshTokenTtlSeconds,
    );

    await this.prismaClient.session.create({
      data: {
        id: sessionId,
        userId,
        refreshTokenHash: hashToken(refreshToken),
        isRevoked: false,
        expiresAt: new Date(Date.now() + this.refreshTokenTtlSeconds * 1000),
      } satisfies Prisma.SessionUncheckedCreateInput,
    });

    return { accessToken, refreshToken };
  }

  private verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
    try {
      return this.jwtTokenCodec.verify<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new InvalidRefreshTokenError();
    }
  }
}
