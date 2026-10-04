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

// Syntactically valid bcrypt hash of a throwaway value — never a real
// credential. Its cost factor (12) MUST equal the one the real hasher uses
// (BcryptPasswordHasher.BCRYPT_SALT_ROUNDS): bcrypt time doubles per cost
// step, so a lower cost makes unknown accounts measurably faster (measured:
// cost 10 = ~64 ms vs cost 12 = ~254 ms) and defeats the timing protection.
const DUMMY_PASSWORD_HASH = '$2b$12$7irbQ5LXMyoaQFmTLtzC1eySZGqAcpYWel1GwQEWJsTOh/ZWRtL7e';

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

    // Always run the hash comparison, even for an unknown account: a bcrypt
    // verify takes measurable time, so short-circuiting on `user === null`
    // would make login faster for unregistered emails than for registered
    // ones — a timing side channel that lets an attacker enumerate accounts.
    const passwordMatches = await this.passwordHasher.verify(
      input.plainPassword,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    // A deactivated account gets the same generic error as a wrong password,
    // checked after verify() so it is neither observable nor faster.
    if (user === null || !passwordMatches || !user.isActive) {
      throw new InvalidCredentialsError();
    }

    const tokens = await this.authTokenService.issueTokenPair(user.id);

    return { user, tokens };
  }
}
