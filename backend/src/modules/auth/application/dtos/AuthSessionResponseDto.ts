import { ApiProperty } from '@nestjs/swagger';
import type { AuthTokenPair } from '../ports/IAuthTokenService';
import type { UserProfile } from './UserProfile';
import { UserResponseDto } from './UserResponseDto';

/** Response of POST /auth/login: the authenticated user plus its freshly issued token pair. */
export class AuthSessionResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ description: 'Short-lived JWT — send as `Authorization: Bearer <token>`' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived, single-use token — send to POST /auth/refresh' })
  refreshToken!: string;

  static from(user: UserProfile, tokens: AuthTokenPair): AuthSessionResponseDto {
    const dto = new AuthSessionResponseDto();
    dto.user = UserResponseDto.fromProfile(user);
    dto.accessToken = tokens.accessToken;
    dto.refreshToken = tokens.refreshToken;
    return dto;
  }
}
