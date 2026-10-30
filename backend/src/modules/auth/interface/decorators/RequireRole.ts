import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import type { RoleName } from '../../../../shared/config/AppConstants';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { REQUIRED_ROLES_METADATA_KEY, RolesGuard } from '../guards/RolesGuard';

/**
 * Restricts a handler (or a whole controller) to users holding one of the given roles. It also applies
 * JwtAuthGuard and RolesGuard itself, in that order: a route cannot carry the role label without the
 * checks, so forgetting `@UseGuards` leaves the route closed, not open (ADR-013).
 */
export function RequireRole(...roles: RoleName[]): ReturnType<typeof applyDecorators> {
  return applyDecorators(
    SetMetadata(REQUIRED_ROLES_METADATA_KEY, roles),
    UseGuards(JwtAuthGuard, RolesGuard),
  );
}
