import { SetMetadata } from '@nestjs/common';
import type { CustomDecorator } from '@nestjs/common';
import type { RoleName } from '../../../../shared/config/AppConstants';

export const REQUIRED_ROLES_METADATA_KEY = 'auth:required-roles';

/**
 * Restricts a handler (or a whole controller) to users holding one of the given roles. Enforced by
 * RolesGuard, which must run after JwtAuthGuard. Without this decorator RolesGuard refuses everything.
 */
export function RequireRole(...roles: RoleName[]): CustomDecorator<string> {
  return SetMetadata(REQUIRED_ROLES_METADATA_KEY, roles);
}
