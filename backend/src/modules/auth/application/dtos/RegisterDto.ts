import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

// Matches PASSWORD_MIN_LENGTH's own floor (EnvironmentVariables.ts, min 8). If the env var is
// raised above 8, the domain (Password.create, application/ports/PasswordPolicy.ts) still enforces
// the real configured value — this decorator is only a cheap, static first line of defense.
const PASSWORD_MIN_LENGTH_FLOOR = 8;

export class RegisterDto {
  @ApiProperty({ example: 'trainer@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd!', minLength: PASSWORD_MIN_LENGTH_FLOOR })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH_FLOOR)
  password!: string;

  @ApiProperty({ example: 'ash_ketchum' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({
    example: true,
    description: 'Must be an explicit, affirmative act — never defaulted to true by a client.',
  })
  @IsBoolean()
  hasAcceptedTerms!: boolean;
}
