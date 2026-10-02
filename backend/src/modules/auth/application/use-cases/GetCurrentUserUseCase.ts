import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { UserNotFoundError } from '../errors/AuthErrors';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface GetCurrentUserInput {
  readonly userId: string;
}

@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository) {}

  async execute(input: GetCurrentUserInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(input.userId);
    }

    return user;
  }
}
