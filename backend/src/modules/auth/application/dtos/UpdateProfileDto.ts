import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// The domain enforces 3-32 characters after trimming (User.assertValidUsername); this only bounds the payload.
const USERNAME_MAX_LENGTH = 64;

export class UpdateProfileDto {
  @ApiProperty({ example: 'ash_ketchum', maxLength: USERNAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(USERNAME_MAX_LENGTH)
  username!: string;
}
