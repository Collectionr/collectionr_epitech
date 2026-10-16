import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { Password } from '../../domain/value-objects/Password';
import { toUserProfile } from '../dtos/UserProfile';
import type { UserProfile } from '../dtos/UserProfile';
import {
  ConsentRequiredError,
  EmailAlreadyUsedError,
  TermsVersionMismatchError,
  UsernameAlreadyUsedError,
} from '../errors/AuthErrors';
import { PASSWORD_HASHER } from '../ports/IPasswordHasher';
import type { IPasswordHasher } from '../ports/IPasswordHasher';
import { PASSWORD_MIN_LENGTH } from '../ports/PasswordPolicy';
import { CURRENT_TERMS_VERSION } from '../ports/TermsPolicy';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface RegisterUserInput {
  readonly email: string;
  readonly plainPassword: string;
  readonly username: string;
  /**
   * The version of the terms the user was shown when they ticked the box, or null when they did
   * not accept. Sent by the client, never inferred: it is the proof of what was agreed to, so it
   * must be the one displayed, and an explicit act — never defaulted.
   */
  readonly acceptedTermsVersion: string | null;
}

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwordHasher: IPasswordHasher,
    @Inject(PASSWORD_MIN_LENGTH) private readonly passwordMinLength: number,
    @Inject(CURRENT_TERMS_VERSION) private readonly currentTermsVersion: string,
  ) {}

  async execute(input: RegisterUserInput): Promise<UserProfile> {
    // A missing or blank current version is a deployment bug: fail closed (5xx) instead of
    // accepting registrations nobody could prove anything about.
    if (this.currentTermsVersion.trim() === '') {
      throw new Error('Invalid terms policy: the current terms version must not be empty');
    }
    const acceptedVersion = input.acceptedTermsVersion?.trim() ?? '';
    if (acceptedVersion === '') {
      throw new ConsentRequiredError();
    }
    if (acceptedVersion !== this.currentTermsVersion) {
      throw new TermsVersionMismatchError();
    }

    const email = Email.create(input.email);
    const password = Password.create(
      input.plainPassword,
      this.passwordMinLength,
      this.passwordHasher.maxPasswordBytes,
    );
    // Every cheap check runs before the DB lookup and the (CPU-heavy) hash,
    // so a request that will be rejected anyway costs almost nothing.
    User.assertValidUsername(input.username);

    if ((await this.userRepository.findByEmail(email)) !== null) {
      throw new EmailAlreadyUsedError();
    }
    if ((await this.userRepository.findByUsername(input.username)) !== null) {
      throw new UsernameAlreadyUsedError();
    }

    const passwordHash = await this.passwordHasher.hash(password.value);
    const user = User.register({
      email,
      passwordHash,
      username: input.username,
      termsAcceptedAt: new Date(),
      termsVersion: acceptedVersion,
    });

    return toUserProfile(await this.userRepository.save(user));
  }
}
