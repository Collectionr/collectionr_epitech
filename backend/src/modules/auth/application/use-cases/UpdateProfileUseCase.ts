import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { UserNotFoundError } from '../errors/AuthErrors';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface UpdateProfileInput {
  readonly userId: string;
  readonly username: string;
}

@Injectable()
export class UpdateProfileUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async execute(input: UpdateProfileInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(input.userId);
    }

    const updated = user.withUsername(input.username);

    return this.userRepository.save(updated);
  }
}
