import { Inject, Injectable } from '@nestjs/common';
import { toUserProfile } from '../dtos/UserProfile';
import type { UserProfile } from '../dtos/UserProfile';
import { UserNotFoundError } from '../errors/AuthErrors';
import { ACCOUNT_ERASURE_AUDIT } from '../ports/IAccountErasureAudit';
import type { IAccountErasureAudit } from '../ports/IAccountErasureAudit';
import { AUTH_TOKEN_SERVICE } from '../ports/IAuthTokenService';
import type { IAuthTokenService } from '../ports/IAuthTokenService';
import { USER_REPOSITORY } from '../ports/IUserRepository';
import type { IUserRepository } from '../ports/IUserRepository';

export interface RequestAccountDeletionInput {
  readonly userId: string;
}

/**
 * The user asks for the erasure of their account (RGPD Art. 17): the account is deactivated and its
 * sessions ended at once, and AnonymizeDueAccountsUseCase anonymizes it when the grace period is over.
 * Proving that the caller is the account holder (password, fresh login) is the interface's job.
 */
@Injectable()
export class RequestAccountDeletionUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(AUTH_TOKEN_SERVICE) private readonly authTokenService: IAuthTokenService,
    @Inject(ACCOUNT_ERASURE_AUDIT) private readonly erasureAudit: IAccountErasureAudit,
  ) {}

  async execute(input: RequestAccountDeletionInput): Promise<UserProfile> {
    const user = await this.userRepository.findById(input.userId);
    // An anonymized account no longer exists as far as its former holder is concerned.
    if (user === null || user.isAnonymized) {
      throw new UserNotFoundError();
    }

    // A second request does not restart the grace period (User.requestDeletion returns the same
    // account), and is not saved again. The sessions are revoked either way, so repeating the call
    // finishes a previous attempt that failed halfway — also for an account an admin had already
    // deactivated, whose save revokes nothing since it was no longer active.
    // The request is traced once, when it is recorded, and before it is: no trace, no request.
    const requested = user.deletedAt === null ? user.requestDeletion() : user;
    if (requested !== user) {
      await this.erasureAudit.recordDeletionRequested(user.id);
    }
    const saved = requested === user ? user : await this.userRepository.save(requested);
    await this.authTokenService.revokeAllRefreshTokens(user.id);

    return toUserProfile(saved);
  }
}
