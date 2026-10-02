import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';

/**
 * Thin sign/verify wrapper around `jsonwebtoken`, shared by JwtAuthTokenService (issuing) and
 * JwtAuthGuard (verifying access tokens) so the signing secret is read from ConfigService in one
 * place. Deliberately not @nestjs/jwt: that package is ESM-only (v12, `"type": "module"`) and
 * breaks Jest's CJS transform — the same class of NodeNext/ESM interop trap already hit by the
 * generated Prisma client (see .claude/errors/prisma7_ts-node_js_extension_resolution.md).
 */
@Injectable()
export class JwtTokenCodec {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: object, expiresInSeconds: number): string {
    return jwt.sign(payload, this.secret, { expiresIn: expiresInSeconds });
  }

  /** Throws jsonwebtoken's JsonWebTokenError/TokenExpiredError on an invalid/expired token. */
  verify<T extends JwtPayload>(token: string): T {
    return jwt.verify(token, this.secret) as T;
  }

  private get secret(): string {
    // Validated non-empty (>= 32 chars) at boot by EnvironmentVariables.ts.
    return this.configService.get<string>('JWT_SECRET') as string;
  }
}
