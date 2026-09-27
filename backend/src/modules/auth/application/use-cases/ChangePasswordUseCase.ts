import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { Password } from '../../domain/value-objects/Password';
import { IncorrectCurrentPasswordError, UserNotFoundError } from '../errors/AuthErrors';
import { PASSWORD_HASHER } from '../ports/IPasswordHasher';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { PASSWORD_MIN_LENGTH } from '../ports/PasswordPolicy';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface ChangePasswordInput {
  readonly userId: string;
  readonly currentPassword: string;
  readonly newPassword: string;
}

@Injectable()
export class ChangePasswordUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(PASSWORD_MIN_LENGTH) private readonly passwordMinLength: number,
  ) {}

  async execute(input: ChangePasswordInput): Promise<User> {
    const user = await this.userRepository.findById(input.userId);
    if (user === null) {
      throw new UserNotFoundError(input.userId);
    }

    const currentMatches = await this.passwordHasher.verify(
      input.currentPassword,
      user.passwordHash,
    );
    if (!currentMatches) {
      throw new IncorrectCurrentPasswordError();
    }

    const newPassword = Password.create(input.newPassword, this.passwordMinLength);
    const newPasswordHash = await this.passwordHasher.hash(newPassword.value);
    const updated = user.withPasswordHash(newPasswordHash);

    return this.userRepository.save(updated);
  }
}
