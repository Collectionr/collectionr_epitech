import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Audit } from '../../../audit/interface/decorators/Audit';
import { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import { LoginUserUseCase } from '../../application/use-cases/LoginUserUseCase';
import { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase';
import { LogoutUserUseCase } from '../../application/use-cases/LogoutUserUseCase';
import { RegisterDto } from '../../application/dtos/RegisterDto';
import { LoginDto } from '../../application/dtos/LoginDto';
import { RefreshTokenDto } from '../../application/dtos/RefreshTokenDto';
import { UserResponseDto } from '../../application/dtos/UserResponseDto';
import { AuthSessionResponseDto } from '../../application/dtos/AuthSessionResponseDto';
import { AuthTokenResponseDto } from '../../application/dtos/AuthTokenResponseDto';
import { mapAuthError, mapRegistrationOrPasswordError } from '../MapAuthError';
import { RateLimit } from '../decorators/RateLimit';
import { RedisRateLimitGuard } from '../guards/RedisRateLimitGuard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registerUserUseCase: RegisterUserUseCase,
    private readonly loginUserUseCase: LoginUserUseCase,
    private readonly refreshTokenUseCase: RefreshTokenUseCase,
    private readonly logoutUserUseCase: LogoutUserUseCase,
  ) {}

  @Post('register')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ name: 'register' })
  @Audit({ action: 'auth.register', targetType: 'user', bodyFields: ['email'] })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new account' })
  async register(@Body() dto: RegisterDto): Promise<UserResponseDto> {
    try {
      const user = await this.registerUserUseCase.execute({
        email: dto.email,
        plainPassword: dto.password,
        username: dto.username,
        hasAcceptedTerms: dto.hasAcceptedTerms,
      });
      return UserResponseDto.fromDomain(user);
    } catch (error) {
      mapRegistrationOrPasswordError(error);
      throw error;
    }
  }

  @Post('login')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit({ name: 'login' })
  @Audit({ action: 'auth.login', targetType: 'user', bodyFields: ['email'] })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate and receive an access/refresh token pair' })
  async login(@Body() dto: LoginDto): Promise<AuthSessionResponseDto> {
    try {
      const { user, tokens } = await this.loginUserUseCase.execute({
        email: dto.email,
        plainPassword: dto.password,
      });
      return AuthSessionResponseDto.from(user, tokens);
    } catch (error) {
      mapAuthError(error);
      throw error;
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new access/refresh token pair' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokenResponseDto> {
    try {
      const tokens = await this.refreshTokenUseCase.execute({ refreshToken: dto.refreshToken });
      return AuthTokenResponseDto.fromDomain(tokens);
    } catch (error) {
      mapAuthError(error);
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token (idempotent)' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logoutUserUseCase.execute({ refreshToken: dto.refreshToken });
  }
}
