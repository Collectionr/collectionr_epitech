import { Inject, Injectable } from '@nestjs/common';
import { toUserProfile } from '../dtos/UserProfile';
import type { UserProfile } from '../dtos/UserProfile';
import { UserNotFoundError } from '../errors/AuthErrors';
import { AUTH_TOKEN_SERVICE } from '../ports/IAuthTokenService';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface DeactivateUserInput {
  readonly userId: string;
}

/**
 * Deactivates an account AND ends its sessions: a flag alone would leave every refresh token the
 * account already holds usable. Who may call this (admin only, CDC §3.5) is an interface concern
 * (role guard), not decided here.
 */
@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUTH_TOKEN_SERVICE) private readonly authTokenService: IAuthTokenService,
  ) {}

  async execute(input: DeactivateUserInput): Promise<UserProfile> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError();
    }

    // Deactivate first: from that moment no new session can be opened (login refuses the account).
    // Revoking first would leave a window in which the user logs in again and gets a fresh session.
    // An already deactivated account is not saved again, but its sessions are still revoked, so
    // repeating the call finishes a previous attempt that failed halfway.
    const current = user.isActive ? await this.userRepository.save(user.deactivate()) : user;
    await this.authTokenService.revokeAllRefreshTokens(user.id);

    return toUserProfile(current);
  }
}
