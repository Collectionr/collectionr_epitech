import { Inject, Injectable } from '@nestjs/common';
import { AUTH_TOKEN_SERVICE } from '../ports/IAuthTokenService';
import type { AuthTokenPair, IAuthTokenService } from '../ports/IAuthTokenService';

export interface RefreshTokenInput {
  readonly refreshToken: string;
}

@Injectable()
export class RefreshTokenUseCase {
  constructor(@Inject(AUTH_TOKEN_SERVICE) private readonly authTokenService: IAuthTokenService) {}

  /** Propagates InvalidRefreshTokenError from the port as-is when the token is invalid/expired/revoked. */
  async execute(input: RefreshTokenInput): Promise<AuthTokenPair> {
    return this.authTokenService.rotateRefreshToken(input.refreshToken);
  }
}
