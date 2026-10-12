import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { UserNotFoundError } from '../errors/AuthErrors';
import { AUTH_TOKEN_SERVICE } from '../ports/IAuthTokenService';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface DeactivateUserInput {
  readonly userId: string;
}

/** Admin action (CDC §3.5). No HTTP route yet: it needs the RBAC guard, which does not exist. */
@Injectable()
export class DeactivateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUTH_TOKEN_SERVICE) private readonly authTokenService: IAuthTokenService,
  ) {}

  async execute(input: DeactivateUserInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(input.userId);
    }

    const deactivated = user.isActive ? await this.userRepository.save(user.deactivate()) : user;

    // Also when the account was already deactivated: this is what makes a retry after a failure
    // here converge. Rotation and the access guard refuse inactive accounts regardless, this just
    // stops leaving live sessions behind.
    await this.authTokenService.revokeAllRefreshTokens(user.id);

    return deactivated;
  }
}
