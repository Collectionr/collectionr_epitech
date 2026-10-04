import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { ConsentRequiredError, EmailAlreadyUsedError } from '../errors/AuthErrors';
import { PASSWORD_HASHER } from '../ports/IPasswordHasher';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { PASSWORD_MIN_LENGTH } from '../ports/PasswordPolicy';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface RegisterUserInput {
  readonly email: string;
  readonly plainPassword: string;
  readonly username: string;
  /** RGPD scaffold: must be an explicit, affirmative act — never defaulted to true. */
  readonly hasAcceptedTerms: boolean;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(PASSWORD_MIN_LENGTH) private readonly passwordMinLength: number,
  ) {}

  async execute(input: RegisterUserInput): Promise<User> {
    if (!input.hasAcceptedTerms) {
      throw new ConsentRequiredError();
    }

    const email = Email.create(input.email);
    const password = Password.create(input.plainPassword, this.passwordMinLength);
    // Every cheap check runs before the DB lookup and the (CPU-heavy) hash,
    // so a request that will be rejected anyway costs almost nothing.
    User.assertValidUsername(input.username);

    const existing = await this.userRepository.findByEmail(email);
    if (existing !== null) {
      throw new EmailAlreadyUsedError(email.value);
    }

    const passwordHash = await this.passwordHasher.hash(password.value);
    const user = User.register({
      email,
      passwordHash,
      username: input.username,
      consentGivenAt: new Date(),
    });

    return this.userRepository.save(user);
  }
}
