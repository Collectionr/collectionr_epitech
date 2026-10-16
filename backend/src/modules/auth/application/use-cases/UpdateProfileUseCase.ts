import { Inject, Injectable } from '@nestjs/common';
import { toUserProfile } from '../dtos/UserProfile';
import type { UserProfile } from '../dtos/UserProfile';
import { UserNotFoundError, UsernameAlreadyUsedError } from '../errors/AuthErrors';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface UpdateProfileInput {
  readonly userId: string;
  readonly username: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateProfileInput): Promise<UserProfile> {
    const user = await this.userRepository.findById(input.userId);
    // A deactivated account is invisible and read-only, same as an unknown one. An authentication
    // layer normally refuses it earlier; this is the use case not trusting that it always runs first.
    if (user === null || !user.isActive) {
      throw new UserNotFoundError();
    }

    const updated = user.withUsername(input.username);

    // The username may be taken by someone else, never by the user themself: changing only the
    // case of one's own username ("ash" -> "Ash") is a legitimate edit.
    const owner = await this.userRepository.findByUsername(input.username);
    if (owner !== null && owner.id !== user.id) {
      throw new UsernameAlreadyUsedError();
    }

    return toUserProfile(await this.userRepository.save(updated));
  }
}
