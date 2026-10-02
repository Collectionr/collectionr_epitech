import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // Deliberately not @IsEmail(): LoginUserUseCase treats a malformed email as
  // InvalidCredentialsError, same as a wrong password (no enumeration signal,
  // see the comment in LoginUserUseCase.ts). A DTO-level format check would
  // leak "this part was wrong" via a distinct 400 response before that logic runs.
  @ApiProperty({ example: 'trainer@example.com' })
  @IsString()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({ example: 'Str0ngPassw0rd!' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
