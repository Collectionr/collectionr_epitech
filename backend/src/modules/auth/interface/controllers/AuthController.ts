import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { setAuditSubject } from '../../../audit/interface/AuditRequestContext';
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
import {
  LOGIN_RATE_LIMIT,
  LOGOUT_RATE_LIMIT,
  REFRESH_RATE_LIMIT,
  REGISTER_RATE_LIMIT,
} from '../AuthRateLimits';
import { mapAuthError, mapRegistrationOrPasswordError } from '../MapAuthError';
import { RateLimit } from '../decorators/RateLimit';
import { RedisRateLimitGuard } from '../guards/RedisRateLimitGuard';

// `@Req()` is the one native access here: login and register authenticate *during* the handler, so
// the audit trail cannot learn who acted from a guard — the handler tells it (see AuditRequestContext).
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
  @RateLimit(REGISTER_RATE_LIMIT)
  @Audit({ action: 'auth.register', targetType: 'user' })
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new account' })
  @ApiCreatedResponse({ description: 'Account created', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload, or terms of service not accepted' })
  @ApiConflictResponse({
    description: 'Email or username already used, or terms version is not the current one',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many registrations, see Retry-After' })
  @ApiServiceUnavailableResponse({ description: 'Rate limiting unavailable' })
  async register(
    @Body() dto: RegisterDto,
    @Req() request: FastifyRequest,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.registerUserUseCase.execute({
        email: dto.email,
        plainPassword: dto.password,
        username: dto.username,
        acceptedTermsVersion: dto.acceptedTermsVersion ?? null,
      });
      setAuditSubject(request, { actorId: user.id, targetId: user.id });
      return UserResponseDto.fromProfile(user);
    } catch (error) {
      mapRegistrationOrPasswordError(error);
      throw error;
    }
  }

  @Post('login')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(LOGIN_RATE_LIMIT)
  @Audit({ action: 'auth.login', targetType: 'user' })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Authenticate and receive an access/refresh token pair' })
  @ApiOkResponse({ description: 'Authenticated', type: AuthSessionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts, see Retry-After' })
  @ApiServiceUnavailableResponse({ description: 'Rate limiting unavailable' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
  ): Promise<AuthSessionResponseDto> {
    try {
      const { user, tokens } = await this.loginUserUseCase.execute({
        email: dto.email,
        plainPassword: dto.password,
      });
      setAuditSubject(request, { actorId: user.id, targetId: user.id });
      return AuthSessionResponseDto.from(user, tokens);
    } catch (error) {
      mapAuthError(error);
      throw error;
    }
  }

  @Post('refresh')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(REFRESH_RATE_LIMIT)
  @Audit({ action: 'auth.refresh', targetType: 'session' })
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Header('Pragma', 'no-cache')
  @ApiOperation({ summary: 'Rotate a refresh token for a new access/refresh token pair' })
  @ApiOkResponse({ description: 'New token pair issued', type: AuthTokenResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired or revoked refresh token' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests, see Retry-After' })
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
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(LOGOUT_RATE_LIMIT)
  @Audit({ action: 'auth.logout', targetType: 'session' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh token (idempotent)' })
  @ApiNoContentResponse({
    description: 'Login chain revoked (also answered when the token was already invalid)',
  })
  @ApiBadRequestResponse({ description: 'Invalid payload' })
  @ApiTooManyRequestsResponse({ description: 'Too many requests, see Retry-After' })
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.logoutUserUseCase.execute({ refreshToken: dto.refreshToken });
  }
}
