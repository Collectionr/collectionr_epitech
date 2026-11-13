import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

// Matches PASSWORD_MIN_LENGTH's own floor (EnvironmentVariables.ts, min 8). If the env var is
// raised above 8, the domain (Password.create, application/ports/PasswordPolicy.ts) still enforces
// the real value — this decorator is only a cheap, static first line of defense.
const PASSWORD_MIN_LENGTH_FLOOR = 8;

// Upper bounds exist to refuse absurd payloads before they cost anything (a hash, an audit row, a
// log line). The domain stays the authority: 72 bytes for a password, 3-32 for a username.
const EMAIL_MAX_LENGTH = 254; // RFC 5321
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_MAX_LENGTH = 64;

// Same shape as TERMS_VERSION (EnvironmentVariables.ts): the version is an identifier, not free text.
const TERMS_VERSION_PATTERN = /^[A-Za-z0-9._-]{1,32}$/;

export class RegisterDto {
  @ApiProperty({ example: 'trainer@example.com', maxLength: EMAIL_MAX_LENGTH })
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({
    example: 'Str0ngPassw0rd!',
    minLength: PASSWORD_MIN_LENGTH_FLOOR,
    maxLength: PASSWORD_MAX_LENGTH,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_FLOOR)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty({ example: 'ash_ketchum', maxLength: USERNAME_MAX_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(USERNAME_MAX_LENGTH)
  username!: string;

  @ApiProperty({
    example: '1',
    required: true,
    description:
      'Version of the terms of service the user was shown and accepted. Required: an absent or ' +
      'blank value is refused with 400, a version that is not the current one with 409. Never ' +
      'defaulted by the client.',
  })
  @IsOptional()
  @IsString()
  @Matches(TERMS_VERSION_PATTERN)
  acceptedTermsVersion?: string;
}
