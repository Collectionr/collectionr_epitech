import type { RoleName } from '../../../../shared/config/AppConstants';

export const USER_ROLE_RESOLVER = 'USER_ROLE_RESOLVER';

/**
 * Application port: which role a user holds, read from the store on each request (ADR-013). The role
 * is never taken from the access token: a token outlives a demotion, the store does not.
 */
export interface IUserRoleResolver {
  /**
   * The user's role name, or null when the user does not exist or the stored role is not one this
   * application knows. Null is a refusal, never a default role.
   */
  roleOf(userId: string): Promise<RoleName | null>;
}
