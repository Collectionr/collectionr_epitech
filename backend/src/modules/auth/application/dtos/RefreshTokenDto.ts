import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// A signed refresh token is ~400 characters.
const REFRESH_TOKEN_MAX_LENGTH = 2048;

export class RefreshTokenDto {
  @ApiProperty({
    description: 'Refresh token previously issued by /auth/login or /auth/refresh',
    maxLength: REFRESH_TOKEN_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(REFRESH_TOKEN_MAX_LENGTH)
  refreshToken!: string;
}
