import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { InvalidCredentialsError } from '../errors/AuthErrors';
import { AUTH_TOKEN_SERVICE } from '../ports/IAuthTokenService';
import type { AuthTokenPair, IAuthTokenService } from '../ports/IAuthTokenService';
import { PASSWORD_HASHER } from '../ports/IPasswordHasher';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface LoginUserInput {
  readonly email: string;
  readonly plainPassword: string;
}

export interface LoginUserResult {
  readonly user: User;
  readonly tokens: AuthTokenPair;
}

@Injectable()
export class LoginUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(AUTH_TOKEN_SERVICE) private readonly authTokenService: IAuthTokenService,
  ) {}

  async execute(input: LoginUserInput): Promise<LoginUserResult> {
    // An invalid email format is reported as invalid credentials, not a
    // validation error: the error must not reveal which part was wrong.
    let email: Email;
    try {
      email = Email.create(input.email);
    } catch {
      throw new InvalidCredentialsError();
    }

    const user = await this.userRepository.findByEmail(email);
    if (user === null) {
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await this.passwordHasher.verify(
      input.plainPassword,
      user.passwordHash,
    );
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    const tokens = await this.authTokenService.issueTokenPair(user.id);

    return { user, tokens };
  }
}
