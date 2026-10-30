import { Body, Controller, Get, Header, Patch, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';
import { SWAGGER_BEARER_AUTH_NAME } from '../../../../shared/bootstrap/SetupSwagger';
import { setAuditSubject } from '../../../audit/interface/AuditRequestContext';
import { Audit } from '../../../audit/interface/decorators/Audit';
import { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase';
import { ChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase';
import { UpdateProfileUseCase } from '../../application/use-cases/UpdateProfileUseCase';
import { ChangePasswordDto } from '../../application/dtos/ChangePasswordDto';
import { UpdateProfileDto } from '../../application/dtos/UpdateProfileDto';
import { UserResponseDto } from '../../application/dtos/UserResponseDto';
import { PASSWORD_CHANGE_RATE_LIMIT } from '../AuthRateLimits';
import { mapAuthError, mapRegistrationOrPasswordError } from '../MapAuthError';
import { CurrentUser } from '../decorators/CurrentUser';
import { RateLimit } from '../decorators/RateLimit';
import type { AuthenticatedUser } from '../guards/JwtAuthGuard';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { RedisRateLimitGuard } from '../guards/RedisRateLimitGuard';

@ApiTags('Auth')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
    private readonly updateProfileUseCase: UpdateProfileUseCase,
  ) {}

  @Get('me')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Current authenticated user profile' })
  @ApiOkResponse({ description: 'Profile of the authenticated user', type: UserResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  @ApiNotFoundResponse({ description: 'The account no longer exists' })
  async getMe(@CurrentUser() currentUser: AuthenticatedUser): Promise<UserResponseDto> {
    try {
      const user = await this.getCurrentUserUseCase.execute({ userId: currentUser.id });
      return UserResponseDto.fromProfile(user);
    } catch (error) {
      mapAuthError(error);
      throw error;
    }
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile' })
  @ApiOkResponse({ description: 'Profile updated', type: UserResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or username' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  @ApiNotFoundResponse({ description: 'The account no longer exists' })
  @ApiConflictResponse({
    description: 'Username already used, or the account was modified concurrently',
  })
  async updateProfile(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.updateProfileUseCase.execute({
        userId: currentUser.id,
        username: dto.username,
      });
      return UserResponseDto.fromProfile(user);
    } catch (error) {
      mapRegistrationOrPasswordError(error);
      throw error;
    }
  }

  // `@Req()` is needed to tell the audit trail which entity the action targeted: there is no id in
  // this route for `targetIdParam` to read (see AuditRequestContext).
  @Patch('me/password')
  @UseGuards(RedisRateLimitGuard)
  @RateLimit(PASSWORD_CHANGE_RATE_LIMIT)
  @Audit({ action: 'auth.password_change', targetType: 'user' })
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiOkResponse({
    description: 'Password changed, every session of the user is revoked',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid payload, weak new password, or new password equal to the current one',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or expired access token, or incorrect current password',
  })
  @ApiNotFoundResponse({ description: 'The account no longer exists' })
  @ApiConflictResponse({ description: 'The account was modified concurrently, retry' })
  @ApiTooManyRequestsResponse({ description: 'Too many attempts, see Retry-After' })
  @ApiServiceUnavailableResponse({ description: 'Rate limiting unavailable' })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() request: FastifyRequest,
  ): Promise<UserResponseDto> {
    setAuditSubject(request, { targetId: currentUser.id });
    try {
      const user = await this.changePasswordUseCase.execute({
        userId: currentUser.id,
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
      });
      return UserResponseDto.fromProfile(user);
    } catch (error) {
      mapRegistrationOrPasswordError(error);
      throw error;
    }
  }
}
