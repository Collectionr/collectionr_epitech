import { randomUUID } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import { InvalidTokenError, JwtTokenCodec } from './JwtTokenCodec';

const SECRET = 'a-test-secret-of-at-least-32-characters-long';
const ISSUER = 'collectionr-api';
const USER_ID = randomUUID();
const SESSION_ID = randomUUID();
const FAMILY_ID = randomUUID();

function buildCodec(secret = SECRET): JwtTokenCodec {
  return new JwtTokenCodec({ get: () => secret } as unknown as ConfigService);
}

function forge(payload: object, options: jwt.SignOptions & { secret?: string } = {}): string {
  const { secret = SECRET, ...signOptions } = options;
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn: 60, ...signOptions });
}

describe('JwtTokenCodec', () => {
  const codec = buildCodec();

  describe('access tokens', () => {
    it('round-trips its claims', () => {
      const token = codec.signAccessToken({ sub: USER_ID, fam: FAMILY_ID }, 900);

      expect(codec.verifyAccessToken(token)).toEqual({ sub: USER_ID, fam: FAMILY_ID });
    });

    it('is signed HS256 with the issuer, the access audience and typ=access', () => {
      const token = codec.signAccessToken({ sub: USER_ID, fam: FAMILY_ID }, 900);
      const decoded = jwt.decode(token, { complete: true });

      expect(decoded?.header.alg).toBe('HS256');
      expect(decoded?.payload).toMatchObject({
        iss: ISSUER,
        aud: 'collectionr:access',
        typ: 'access',
        sub: USER_ID,
        fam: FAMILY_ID,
      });
    });

    it('rejects a refresh token (right secret, right issuer, wrong kind)', () => {
      const refresh = codec.signRefreshToken({ sub: USER_ID, jti: SESSION_ID, fam: FAMILY_ID }, 60);

      expect(() => codec.verifyAccessToken(refresh)).toThrow(InvalidTokenError);
    });

    it('rejects a token without the typ claim even if signature, issuer and audience are right', () => {
      const token = forge(
        { fam: FAMILY_ID },
        { subject: USER_ID, issuer: ISSUER, audience: 'collectionr:access' },
      );

      expect(() => codec.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });

    it.each([
      ['a sub that is not a UUID', { subject: 'not-a-uuid', fam: FAMILY_ID }],
      ['a family that is not a UUID', { subject: USER_ID, fam: 'nope' }],
      ['no family', { subject: USER_ID, fam: undefined }],
    ])('rejects %s', (_label, { subject, fam }) => {
      const token = forge(
        { typ: 'access', fam },
        { subject, issuer: ISSUER, audience: 'collectionr:access' },
      );

      expect(() => codec.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });
  });

  describe('refresh tokens', () => {
    it('round-trips its claims', () => {
      const token = codec.signRefreshToken({ sub: USER_ID, jti: SESSION_ID, fam: FAMILY_ID }, 60);

      expect(codec.verifyRefreshToken(token)).toEqual({
        sub: USER_ID,
        jti: SESSION_ID,
        fam: FAMILY_ID,
      });
    });

    it('rejects an access token: it has no jti, which used to turn a revoke into a wildcard', () => {
      const access = codec.signAccessToken({ sub: USER_ID, fam: FAMILY_ID }, 900);

      expect(() => codec.verifyRefreshToken(access)).toThrow(InvalidTokenError);
    });

    it.each([
      ['a jti that is not a UUID', { jti: "' OR 1=1 --", fam: FAMILY_ID }],
      ['no jti', { jti: undefined, fam: FAMILY_ID }],
      ['a numeric jti', { jti: 12345, fam: FAMILY_ID }],
      ['no family', { jti: SESSION_ID, fam: undefined }],
      ['a family that is not a UUID', { jti: SESSION_ID, fam: 'x' }],
    ])('rejects %s', (_label, claims) => {
      const token = forge(
        { typ: 'refresh', ...claims },
        { subject: USER_ID, issuer: ISSUER, audience: 'collectionr:refresh' },
      );

      expect(() => codec.verifyRefreshToken(token)).toThrow(InvalidTokenError);
    });
  });

  describe('verification strictness (both kinds)', () => {
    it('rejects an unsigned token (alg: none)', () => {
      const unsigned = [
        Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
        Buffer.from(
          JSON.stringify({
            typ: 'access',
            sub: USER_ID,
            fam: FAMILY_ID,
            iss: ISSUER,
            aud: 'collectionr:access',
            exp: Math.floor(Date.now() / 1000) + 600,
          }),
        ).toString('base64url'),
        '',
      ].join('.');

      expect(() => codec.verifyAccessToken(unsigned)).toThrow(InvalidTokenError);
    });

    it('rejects a token signed with another HMAC algorithm', () => {
      const hs512 = forge(
        { typ: 'access', fam: FAMILY_ID },
        { subject: USER_ID, issuer: ISSUER, audience: 'collectionr:access', algorithm: 'HS512' },
      );

      expect(() => codec.verifyAccessToken(hs512)).toThrow(InvalidTokenError);
    });

    it('rejects a token signed with another secret', () => {
      const token = forge(
        { typ: 'access', fam: FAMILY_ID },
        {
          subject: USER_ID,
          issuer: ISSUER,
          audience: 'collectionr:access',
          secret: 'another-secret-of-at-least-32-characters!!',
        },
      );

      expect(() => codec.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });

    it('rejects a token from another issuer', () => {
      const token = forge(
        { typ: 'access', fam: FAMILY_ID },
        { subject: USER_ID, issuer: 'someone-else', audience: 'collectionr:access' },
      );

      expect(() => codec.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });

    it('rejects a token meant for another audience', () => {
      const token = forge(
        { typ: 'access', fam: FAMILY_ID },
        { subject: USER_ID, issuer: ISSUER, audience: 'some-other-service' },
      );

      expect(() => codec.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });

    it('rejects an expired token', () => {
      const token = forge(
        { typ: 'access', fam: FAMILY_ID },
        { subject: USER_ID, issuer: ISSUER, audience: 'collectionr:access', expiresIn: -10 },
      );

      expect(() => codec.verifyAccessToken(token)).toThrow(InvalidTokenError);
    });

    it('rejects garbage', () => {
      expect(() => codec.verifyAccessToken('garbage')).toThrow(InvalidTokenError);
      expect(() => codec.verifyRefreshToken('')).toThrow(InvalidTokenError);
    });
  });
});
