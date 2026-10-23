import { createHash, randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../../../generated/prisma/client.js';
import {
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../../application/errors/AuthErrors';
import type { AuthTokenPair, IAuthTokenService } from '../../application/ports/IAuthTokenService';
import type { ISessionPurger } from '../../application/ports/ISessionPurger';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import { JwtTokenCodec } from './JwtTokenCodec';
import type { RefreshTokenClaims } from './JwtTokenCodec';

/** Injection token: access token lifetime, in seconds (JWT_ACCESS_TOKEN_TTL_SECONDS). */
export const ACCESS_TOKEN_TTL_SECONDS = 'ACCESS_TOKEN_TTL_SECONDS';
/** Injection token: refresh token lifetime, in seconds (JWT_REFRESH_TOKEN_TTL_SECONDS). */
export const REFRESH_TOKEN_TTL_SECONDS = 'REFRESH_TOKEN_TTL_SECONDS';
/** Injection token: hard end of a login chain however often it is refreshed (JWT_SESSION_MAX_LIFETIME_SECONDS). */
export const SESSION_MAX_LIFETIME_SECONDS = 'SESSION_MAX_LIFETIME_SECONDS';

const MILLISECONDS_PER_SECOND = 1000;

type RotationOutcome =
  { readonly kind: 'rotated'; readonly pair: AuthTokenPair } | { readonly kind: 'rejected' };

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * IAuthTokenService implementation: JWT access/refresh tokens (jsonwebtoken, via JwtTokenCodec),
 * refresh sessions persisted in PostgreSQL (`sessions` table, docs/database/schema-sql.md SESSION).
 *
 * - One row per refresh token, linked by `familyId` into a login chain; a rotation retires the row
 *   (`rotatedAt`) and creates the next one. Presenting a retired token again means it leaked, so the
 *   whole chain is revoked.
 * - Every operation that reads-then-writes the sessions of a user takes `SELECT ... FOR UPDATE` on
 *   that user's row first. Rotation, bulk revocation, a password change and a deactivation (the
 *   last two inside PrismaUserRepository.save) therefore queue behind each other instead of
 *   interleaving: no rotation can slip a fresh session in after the revocation that was meant to
 *   kill the chain, and N concurrent rotations of one token yield at most one success.
 * - The refresh token's hash (sha256) is defense in depth only: the claims are validated UUIDs and
 *   the lookup is by primary key.
 */
@Injectable()
export class JwtAuthTokenService implements IAuthTokenService, ISessionPurger {
  constructor(
    private readonly jwtTokenCodec: JwtTokenCodec,
    @Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient,
    @Inject(ACCESS_TOKEN_TTL_SECONDS) private readonly accessTokenTtlSeconds: number,
    @Inject(REFRESH_TOKEN_TTL_SECONDS) private readonly refreshTokenTtlSeconds: number,
    @Inject(SESSION_MAX_LIFETIME_SECONDS) private readonly sessionMaxLifetimeSeconds: number,
  ) {}

  async issueTokenPair(userId: string): Promise<AuthTokenPair> {
    if (!isUuid(userId)) {
      throw new InvalidCredentialsError();
    }

    return this.prismaClient.$transaction(async (tx) => {
      const user = await this.lockUser(tx, userId);
      // Login checked the account just before, but not under this lock: a deactivation committed in
      // between must not be answered with a fresh session.
      if (user === null || !user.isActive) {
        throw new InvalidCredentialsError();
      }

      const now = new Date();
      return this.openSession(tx, {
        userId,
        familyId: randomUUID(),
        absoluteExpiresAt: new Date(
          now.getTime() + this.sessionMaxLifetimeSeconds * MILLISECONDS_PER_SECOND,
        ),
        now,
      });
    });
  }

  async rotateRefreshToken(refreshToken: string): Promise<AuthTokenPair> {
    const claims = this.readRefreshTokenClaims(refreshToken);

    const outcome = await this.prismaClient.$transaction((tx) =>
      this.rotateInTransaction(tx, claims, refreshToken),
    );
    if (outcome.kind === 'rejected') {
      throw new InvalidRefreshTokenError();
    }
    return outcome.pair;
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    let claims: RefreshTokenClaims;
    try {
      claims = this.readRefreshTokenClaims(refreshToken);
    } catch {
      // Unknown, malformed, expired or wrong-kind token: nothing to revoke, and revoking must not throw.
      return;
    }

    // The whole login chain, not just the row the token names: a client may present a token that was
    // already rotated, and the live token of that chain must die with it (RFC 7009 §2.1: the access
    // tokens of the same grant should be invalidated too). Other logins of the same user are untouched.
    // `fam` and `sub` are validated here, so the `where` cannot widen: Prisma would silently drop an
    // undefined claim.
    await this.prismaClient.$transaction(async (tx) => {
      // Same lock as revokeAllRefreshTokens: a rotation in flight cannot add a live row after this update.
      await this.lockUser(tx, claims.sub);
      await tx.session.updateMany({
        where: { familyId: claims.fam, userId: claims.sub, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    if (!isUuid(userId)) {
      return;
    }

    await this.prismaClient.$transaction(async (tx) => {
      // Waits for any rotation of this user that is mid-flight, so the session it is about to
      // create is already visible when the update below runs.
      await this.lockUser(tx, userId);
      await tx.session.updateMany({
        where: { userId, isRevoked: false },
        data: { isRevoked: true },
      });
    });
  }

  async purgeExpiredSessions(cutoff: Date): Promise<number> {
    const { count } = await this.prismaClient.session.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
    return count;
  }

  private async rotateInTransaction(
    tx: Prisma.TransactionClient,
    claims: RefreshTokenClaims,
    refreshToken: string,
  ): Promise<RotationOutcome> {
    const user = await this.lockUser(tx, claims.sub);
    if (user === null || !user.isActive) {
      return { kind: 'rejected' };
    }

    const session = await tx.session.findUnique({ where: { id: claims.jti } });
    if (
      session === null ||
      session.userId !== claims.sub ||
      session.familyId !== claims.fam ||
      session.refreshTokenHash !== hashToken(refreshToken)
    ) {
      return { kind: 'rejected' };
    }

    if (session.rotatedAt !== null) {
      // Already exchanged for a newer token and presented again: either a thief or the legitimate
      // client holds a copy it should not. Which one is unknowable, so the whole chain dies.
      await tx.session.updateMany({
        where: { familyId: session.familyId, isRevoked: false },
        data: { isRevoked: true },
      });
      return { kind: 'rejected' };
    }

    const now = new Date();
    if (session.isRevoked || session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      return { kind: 'rejected' };
    }

    // The row lock above already serialises callers; the conditional update is what actually
    // states "single use" and would still hold if the lock were ever removed.
    const burned = await tx.session.updateMany({
      where: { id: session.id, isRevoked: false, rotatedAt: null },
      data: { isRevoked: true, rotatedAt: now },
    });
    if (burned.count !== 1) {
      return { kind: 'rejected' };
    }

    const pair = await this.openSession(tx, {
      userId: session.userId,
      familyId: session.familyId,
      absoluteExpiresAt: session.absoluteExpiresAt,
      now,
    });
    return { kind: 'rotated', pair };
  }

  private async openSession(
    tx: Prisma.TransactionClient,
    chain: {
      readonly userId: string;
      readonly familyId: string;
      readonly absoluteExpiresAt: Date;
      readonly now: Date;
    },
  ): Promise<AuthTokenPair> {
    const sessionId = randomUUID();
    // A refresh can renew the window, never extend the chain past its hard end.
    const expiresAt = new Date(
      Math.min(
        chain.now.getTime() + this.refreshTokenTtlSeconds * MILLISECONDS_PER_SECOND,
        chain.absoluteExpiresAt.getTime(),
      ),
    );
    const refreshTtl = Math.max(
      1,
      Math.floor((expiresAt.getTime() - chain.now.getTime()) / MILLISECONDS_PER_SECOND),
    );

    const refreshToken = this.jwtTokenCodec.signRefreshToken(
      { sub: chain.userId, jti: sessionId, fam: chain.familyId },
      refreshTtl,
    );
    const accessToken = this.jwtTokenCodec.signAccessToken(
      { sub: chain.userId, fam: chain.familyId },
      Math.min(this.accessTokenTtlSeconds, refreshTtl),
    );

    await tx.session.create({
      data: {
        id: sessionId,
        userId: chain.userId,
        familyId: chain.familyId,
        refreshTokenHash: hashToken(refreshToken),
        isRevoked: false,
        expiresAt,
        absoluteExpiresAt: chain.absoluteExpiresAt,
      } satisfies Prisma.SessionUncheckedCreateInput,
    });

    return { accessToken, refreshToken };
  }

  private async lockUser(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<{ readonly isActive: boolean } | null> {
    const rows = await tx.$queryRaw<{ isActive: boolean }[]>`
      SELECT "isActive" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
    return rows[0] ?? null;
  }

  private readRefreshTokenClaims(refreshToken: string): RefreshTokenClaims {
    try {
      return this.jwtTokenCodec.verifyRefreshToken(refreshToken);
    } catch {
      throw new InvalidRefreshTokenError();
    }
  }
}
