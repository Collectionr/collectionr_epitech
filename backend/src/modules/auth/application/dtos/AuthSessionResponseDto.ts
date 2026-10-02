import { ApiProperty } from '@nestjs/swagger';
import type { AuthTokenPair } from '../ports/IAuthTokenService';
import type { User } from '../../domain/entities/User';
import { UserResponseDto } from './UserResponseDto';

/** Response of POST /auth/login: the authenticated user plus its freshly issued token pair. */
export class AuthSessionResponseDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;

  @ApiProperty({ description: 'Short-lived JWT — send as `Authorization: Bearer <token>`' })
  accessToken!: string;

  @ApiProperty({ description: 'Long-lived, single-use token — send to POST /auth/refresh' })
  refreshToken!: string;

  static from(user: User, tokens: AuthTokenPair): AuthSessionResponseDto {
    const dto = new AuthSessionResponseDto();
    dto.user = UserResponseDto.fromDomain(user);
    dto.accessToken = tokens.accessToken;
    dto.refreshToken = tokens.refreshToken;
    return dto;
  }
}
