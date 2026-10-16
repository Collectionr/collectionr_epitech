import type { User } from '../../domain/entities/User';

/**
 * What a use case may hand back about a user: everything the interface layer can need to present,
 * and nothing that is a secret. The password hash stays inside the use cases that must compare it
 * (login, change password) and is never part of an output — a controller or a future caller cannot
 * leak what it never receives.
 */
export interface UserProfile {
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly isActive: boolean;
  readonly termsAcceptedAt: Date;
  readonly termsVersion: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function toUserProfile(user: User): UserProfile {
  return {
    id: user.id,
    email: user.email.value,
    username: user.username,
    isActive: user.isActive,
    termsAcceptedAt: user.termsAcceptedAt,
    termsVersion: user.termsVersion,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
