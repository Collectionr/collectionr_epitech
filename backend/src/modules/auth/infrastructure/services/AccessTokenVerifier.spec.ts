import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { AccessTokenVerifier } from './AccessTokenVerifier';
import { JwtTokenCodec } from './JwtTokenCodec';

const USER_ID = randomUUID();
const FAMILY_ID = randomUUID();

const codec = new JwtTokenCodec({
  get: () => 'a-test-secret-of-at-least-32-characters-long',
} as unknown as ConfigService);

function build(liveSession: unknown): { verifier: AccessTokenVerifier; findFirst: jest.Mock } {
  const findFirst = jest.fn().mockResolvedValue(liveSession);
  const prismaClient = { session: { findFirst } } as unknown as PrismaClient;
  return { verifier: new AccessTokenVerifier(codec, prismaClient), findFirst };
}

const accessToken = (): string => codec.signAccessToken({ sub: USER_ID, fam: FAMILY_ID }, 900);

describe('AccessTokenVerifier', () => {
  it('authenticates a valid access token whose login chain still has a live session', async () => {
    const { verifier } = build({ user: { isActive: true } });

    await expect(verifier.verify(accessToken())).resolves.toEqual({
      userId: USER_ID,
      familyId: FAMILY_ID,
    });
  });

  it('asks for a live session of THAT user in THAT family (not revoked, not expired, not past its hard end)', async () => {
    const { verifier, findFirst } = build({ user: { isActive: true } });

    await verifier.verify(accessToken());

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        familyId: FAMILY_ID,
        userId: USER_ID,
        isRevoked: false,
        expiresAt: { gt: expect.any(Date) as unknown },
        absoluteExpiresAt: { gt: expect.any(Date) as unknown },
      },
      select: { user: { select: { isActive: true } } },
    });
  });

  it('rejects the token once the chain has no live session (logout, password change, deactivation, replay)', async () => {
    const { verifier } = build(null);

    await expect(verifier.verify(accessToken())).resolves.toBeNull();
  });

  it('rejects a token of a deactivated account even if a session row survives', async () => {
    const { verifier } = build({ user: { isActive: false } });

    await expect(verifier.verify(accessToken())).resolves.toBeNull();
  });

  it('rejects a refresh token presented as a bearer, without touching the database', async () => {
    const { verifier, findFirst } = build({ user: { isActive: true } });
    const refresh = codec.signRefreshToken({ sub: USER_ID, jti: randomUUID(), fam: FAMILY_ID }, 60);

    await expect(verifier.verify(refresh)).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('rejects garbage and an empty string without throwing or querying', async () => {
    const { verifier, findFirst } = build({ user: { isActive: true } });

    await expect(verifier.verify('garbage')).resolves.toBeNull();
    await expect(verifier.verify('')).resolves.toBeNull();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
