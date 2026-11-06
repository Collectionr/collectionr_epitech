import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Bounds only. Generous on purpose: a login must never tell "your input was invalid" apart from
// "wrong credentials" for anything that could be a real address or password.
const EMAIL_MAX_LENGTH = 320;
const PASSWORD_MAX_LENGTH = 128;

export class LoginDto {
  // Deliberately not @IsEmail(): LoginUserUseCase treats a malformed email as
  // InvalidCredentialsError, same as a wrong password (no enumeration signal,
  // see the comment in LoginUserUseCase.ts). A DTO-level format check would
  // leak "this part was wrong" via a distinct 400 response before that logic runs.
  @ApiProperty({ example: 'trainer@example.com', maxLength: EMAIL_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd!', maxLength: PASSWORD_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}
