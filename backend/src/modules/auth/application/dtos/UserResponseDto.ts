import { ApiProperty } from '@nestjs/swagger';
import type { UserProfile } from './UserProfile';

/** The response shape is exactly the fields safe to expose; there is no password hash to leak. */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'trainer@example.com' })
  email!: string;

  @ApiProperty({ example: 'ash_ketchum' })
  username!: string;

  @ApiProperty({ example: '2026-09-27T12:00:00.000Z' })
  createdAt!: string;

  /** Field by field, on purpose: whatever else a profile object ever carries is not exposed. */
  static fromProfile(profile: UserProfile): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = profile.id;
    dto.email = profile.email;
    dto.username = profile.username;
    dto.createdAt = profile.createdAt.toISOString();
    return dto;
  }
}
