import { ApiProperty } from '@nestjs/swagger';
import type { User } from '../../domain/entities/User';

/** Never includes passwordHash — the response shape is exactly the fields safe to expose. */
export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'trainer@example.com' })
  email!: string;

  @ApiProperty({ example: 'ash_ketchum' })
  username!: string;

  @ApiProperty({ example: '2026-09-27T12:00:00.000Z' })
  createdAt!: string;

  static fromDomain(user: User): UserResponseDto {
    const dto = new UserResponseDto();
    dto.id = user.id;
    dto.email = user.email.value;
    dto.username = user.username;
    dto.createdAt = user.createdAt.toISOString();
    return dto;
  }
}
