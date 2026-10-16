import { Inject, Injectable } from '@nestjs/common';
import { toUserProfile } from '../dtos/UserProfile';
import type { UserProfile } from '../dtos/UserProfile';
import { UserNotFoundError } from '../errors/AuthErrors';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface GetCurrentUserInput {
  readonly userId: string;
}

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<UserProfile> {
    const user = await this.userRepository.findById(input.userId);
    // A deactivated account is invisible, same as an unknown one.
    if (user === null || !user.isActive) {
      throw new UserNotFoundError(input.userId);
    }

    return toUserProfile(user);
  }
}
