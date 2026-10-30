import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';

export const JWT_ISSUER = 'collectionr-api';

/** One audience per token kind: a token minted for one purpose is rejected by the other's verifier. */
const AUDIENCE = {
  access: 'collectionr:access',
  refresh: 'collectionr:refresh',
} as const;

/** The only algorithm ever accepted or produced: pinned so `alg: none` / algorithm confusion cannot work. */
const ALGORITHM = 'HS256';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccessTokenClaims {
  readonly sub: string;
  /**
   * The family (login chain) the access token belongs to. Bound to the family rather than to one
   * session so that a refresh rotation does not kill the access token of a request still in
   * flight, while logout / password change / deactivation / detected replay (which revoke the
   * family) kill it at once.
   */
  readonly fam: string;
}

export interface RefreshTokenClaims {
  readonly sub: string;
  /** The session row id. */
  readonly jti: string;
  /** The family (login chain) the session belongs to. */
  readonly fam: string;
}

/** Anything wrong with a token: signature, expiry, kind, audience, issuer or claim shape. */
export class InvalidTokenError extends Error {
  constructor() {
    super('Invalid token');
    this.name = 'InvalidTokenError';
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Sign/verify wrapper around `jsonwebtoken`, shared by JwtAuthTokenService (issuing and rotating),
 * AccessTokenVerifier and nothing else, so the secret, the algorithm, the issuer and the claim
 * shapes are defined in one place. Deliberately not @nestjs/jwt: that package is ESM-only (v12,
 * `"type": "module"`) and breaks Jest's CJS transform — the same class of NodeNext/ESM interop trap
 * already hit by the generated Prisma client (.claude/errors/prisma7_ts-node_js_extension_resolution.md).
 *
 * Every verification is strict and returns validated claims: a `jti`/`fam`/`sub` is a UUID or the
 * token is refused, so no downstream query can ever be built from `undefined`.
 */
@Injectable()
export class JwtTokenCodec {
  constructor(private readonly configService: ConfigService) {}

  signAccessToken(claims: AccessTokenClaims, ttlSeconds: number): string {
    return jwt.sign({ typ: 'access', fam: claims.fam }, this.secret, {
      algorithm: ALGORITHM,
      issuer: JWT_ISSUER,
      audience: AUDIENCE.access,
      subject: claims.sub,
      // A fresh id per token: two tokens signed in the same second must still differ.
      jwtid: randomUUID(),
      expiresIn: ttlSeconds,
    });
  }

  signRefreshToken(claims: RefreshTokenClaims, ttlSeconds: number): string {
    return jwt.sign({ typ: 'refresh', fam: claims.fam }, this.secret, {
      algorithm: ALGORITHM,
      issuer: JWT_ISSUER,
      audience: AUDIENCE.refresh,
      subject: claims.sub,
      jwtid: claims.jti,
      expiresIn: ttlSeconds,
    });
  }

  /** @throws InvalidTokenError for anything but a well-formed, unexpired access token. */
  verifyAccessToken(token: string): AccessTokenClaims {
    const payload = this.verify(token, 'access');
    if (!isUuid(payload.sub) || !isUuid(payload.fam)) {
      throw new InvalidTokenError();
    }
    return { sub: payload.sub, fam: payload.fam };
  }

  /** @throws InvalidTokenError for anything but a well-formed, unexpired refresh token. */
  verifyRefreshToken(token: string): RefreshTokenClaims {
    const payload = this.verify(token, 'refresh');
    if (!isUuid(payload.sub) || !isUuid(payload.jti) || !isUuid(payload.fam)) {
      throw new InvalidTokenError();
    }
    return { sub: payload.sub, jti: payload.jti, fam: payload.fam };
  }

  private verify(token: string, kind: keyof typeof AUDIENCE): Record<string, unknown> {
    try {
      const payload = jwt.verify(token, this.secret, {
        algorithms: [ALGORITHM],
        issuer: JWT_ISSUER,
        audience: AUDIENCE[kind],
      });
      if (typeof payload === 'string' || payload.typ !== kind) {
        throw new InvalidTokenError();
      }
      return payload;
    } catch {
      // jsonwebtoken's own errors say why (expired, bad signature...): irrelevant to the caller and
      // not something to surface.
      throw new InvalidTokenError();
    }
  }

  private get secret(): string {
    // Validated at boot by EnvironmentVariables.ts (length, not a placeholder).
    return this.configService.get<string>('JWT_SECRET') as string;
  }
}
