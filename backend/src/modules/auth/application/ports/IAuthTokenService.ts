export const AUTH_TOKEN_SERVICE = 'AUTH_TOKEN_SERVICE';

export interface AuthTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Application port: issuing/verifying JWTs and tracking refresh token
 * sessions (SESSION table, docs/database/schema-sql.md) are infrastructure
 * concerns implemented outside this module.
 */
export interface IAuthTokenService {
  issueTokenPair(userId: string): Promise<AuthTokenPair>;

  /** Verifies, revokes the old token and issues a new pair. Rejects with InvalidRefreshTokenError if invalid/expired/revoked. */
  rotateRefreshToken(refreshToken: string): Promise<AuthTokenPair>;

  /** Idempotent: revoking an already-revoked or unknown token must not throw. */
  revokeRefreshToken(refreshToken: string): Promise<void>;
}
