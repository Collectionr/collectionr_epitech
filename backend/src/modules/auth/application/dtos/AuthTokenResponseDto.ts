import { ApiProperty } from '@nestjs/swagger';
import type { AuthTokenPair } from '../ports/IAuthTokenService';

/** Response of POST /auth/refresh. */
export class AuthTokenResponseDto {
  @ApiProperty({ description: 'Short-lived JWT — send as `Authorization: Bearer <token>`' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived, single-use token — send to POST /auth/refresh' })
  refreshToken!: string;

  static fromDomain(tokens: AuthTokenPair): AuthTokenResponseDto {
    const dto = new AuthTokenResponseDto();
    dto.accessToken = tokens.accessToken;
    dto.refreshToken = tokens.refreshToken;
    return dto;
  }
}
