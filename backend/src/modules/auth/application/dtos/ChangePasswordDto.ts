import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

// See RegisterDto.ts: matches PASSWORD_MIN_LENGTH's own floor, the domain enforces the real value.
const PASSWORD_MIN_LENGTH_FLOOR = 8;
const PASSWORD_MAX_LENGTH = 128;

export class ChangePasswordDto {
  @ApiProperty({ example: 'Str0ngPassw0rd!', maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @ApiProperty({
    example: 'EvenStr0ngerPassw0rd!',
    minLength: PASSWORD_MIN_LENGTH_FLOOR,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_FLOOR)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
