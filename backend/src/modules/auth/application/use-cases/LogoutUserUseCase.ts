import { Inject, Injectable } from '@nestjs/common';
import { AUTH_TOKEN_SERVICE } from '../ports/IAuthTokenService';
import type { IAuthTokenService } from '../ports/IAuthTokenService';

export interface LogoutUserInput {
  readonly refreshToken: string;
}

@Injectable()
export class LogoutUserUseCase {
  constructor(@Inject(AUTH_TOKEN_SERVICE) private readonly authTokenService: IAuthTokenService) {}

  async execute(input: LogoutUserInput): Promise<void> {
    await this.authTokenService.revokeRefreshToken(input.refreshToken);
  }
}
