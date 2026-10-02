import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

// See RegisterDto.ts: matches PASSWORD_MIN_LENGTH's own floor, the domain enforces the real value.
const PASSWORD_MIN_LENGTH_FLOOR = 8;

export class ChangePasswordDto {
  @ApiProperty({ example: 'Str0ngPassw0rd!' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ example: 'EvenStr0ngerPassw0rd!', minLength: PASSWORD_MIN_LENGTH_FLOOR })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_FLOOR)
  newPassword!: string;
}
