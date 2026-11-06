import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import type {
  AuthenticatedPrincipal,
  IAccessTokenVerifier,
} from '../../application/ports/IAccessTokenVerifier';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { JwtTokenCodec } from './JwtTokenCodec';
import type { AccessTokenClaims } from './JwtTokenCodec';

/**
 * A signature and an expiry date are not enough to trust an access token for 15 minutes: after a
 * logout, a password change, a deactivation or a detected replay it must stop working at once. So
 * every call confirms in the database that the token's login chain still has a live session and that
 * the account is still active (one indexed lookup; a Redis cache in front is the day-two option if
 * it ever shows up in a profile).
 */
@Injectable()
export class AccessTokenVerifier implements IAccessTokenVerifier {
  constructor(
    private readonly jwtTokenCodec: JwtTokenCodec,
    @Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient,
  ) {}

  async verify(accessToken: string): Promise<AuthenticatedPrincipal | null> {
    let claims: AccessTokenClaims;
    try {
      claims = this.jwtTokenCodec.verifyAccessToken(accessToken);
    } catch {
      return null;
    }

    const now = new Date();
    const liveSession = await this.prismaClient.session.findFirst({
      where: {
        familyId: claims.fam,
        userId: claims.sub,
        isRevoked: false,
        expiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: { user: { select: { isActive: true } } },
    });
    if (liveSession === null || !liveSession.user.isActive) {
      return null;
    }

    return { userId: claims.sub, familyId: claims.fam };
  }
}
