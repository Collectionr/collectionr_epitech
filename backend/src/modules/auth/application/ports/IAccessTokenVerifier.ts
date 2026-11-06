export const ACCESS_TOKEN_VERIFIER = 'ACCESS_TOKEN_VERIFIER';

export interface AuthenticatedPrincipal {
  readonly userId: string;
  /** The login chain the token belongs to; revoking it kills the token immediately. */
  readonly familyId: string;
}

/**
 * Application port: decides whether a bearer access token still authenticates someone RIGHT NOW.
 *
 * A valid signature is not enough. Returns null (never throws) unless all of these hold:
 * - the token is an access token (a refresh token, however valid, is never accepted here);
 * - the login chain it was issued in still has a live session, so logging out, changing the
 *   password or deactivating the account takes effect at once instead of when the token expires;
 * - the user still exists and is active.
 */
export interface IAccessTokenVerifier {
  verify(accessToken: string): Promise<AuthenticatedPrincipal | null>;
}
