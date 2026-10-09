export const AUTH_TOKEN_SERVICE = 'AUTH_TOKEN_SERVICE';

export interface AuthTokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/**
 * Application port: issuing/verifying JWTs and tracking refresh token
 * sessions (SESSION table, docs/database/schema-sql.md) are infrastructure
 * concerns implemented outside this module.
 *
 * Contract every implementation MUST honor (none of it can be checked by the
 * compiler, so it needs a contract test against the real implementation):
 * - A token is only ever valid for the purpose it was issued for. An access
 *   token presented where a refresh token is expected (rotate/revoke) is an
 *   invalid refresh token, never a crash and never a wildcard.
 * - No operation may widen its target: a malformed or foreign token must
 *   never turn into a query that matches more sessions than the one it names.
 */
export interface IAuthTokenService {
  issueTokenPair(userId: string): Promise<AuthTokenPair>;

  /**
   * Verifies, revokes the old token and issues a new pair.
   * - Rejects with InvalidRefreshTokenError if invalid, expired, revoked, of the wrong
   *   kind, or if the user's account is deactivated.
   * - Single use, atomically: under N concurrent calls with the same token, at most one
   *   succeeds. A token that was already rotated being presented again means it leaked:
   *   the whole chain of sessions it belongs to should be revoked.
   */
  rotateRefreshToken(refreshToken: string): Promise<AuthTokenPair>;

  /**
   * Idempotent and never throws: revoking an already-revoked, unknown, malformed or
   * wrong-kind token is a no-op. Revokes the one session the token names, nothing else.
   */
  revokeRefreshToken(refreshToken: string): Promise<void>;

  /**
   * Revokes every refresh token of the user (all devices). Used when
   * credentials change or an account is deactivated: already-issued refresh
   * tokens must stop working. Access tokens stay valid until they expire
   * (short-lived, stateless).
   */
  revokeAllRefreshTokens(userId: string): Promise<void>;
}
