import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH_NAME } from '../../../../shared/bootstrap/SetupSwagger';
import { Audit } from '../../../audit/interface/decorators/Audit';
import { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase';
import { ChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase';
import { ChangePasswordDto } from '../../application/dtos/ChangePasswordDto';
import { UserResponseDto } from '../../application/dtos/UserResponseDto';
import { mapRegistrationOrPasswordError } from '../MapAuthError';
import { CurrentUser } from '../decorators/CurrentUser';
import type { AuthenticatedUser } from '../guards/JwtAuthGuard';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';

@ApiTags('Auth')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Current authenticated user profile' })
  async getMe(@CurrentUser() currentUser: AuthenticatedUser): Promise<UserResponseDto> {
    const user = await this.getCurrentUserUseCase.execute({ userId: currentUser.id });
    return UserResponseDto.fromDomain(user);
  }

  @Patch('me/password')
  @Audit({ action: 'auth.password_change', targetType: 'user' })
  @ApiOperation({ summary: 'Change the current user password' })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<UserResponseDto> {
    try {
      const user = await this.changePasswordUseCase.execute({
        userId: currentUser.id,
        currentPassword: dto.currentPassword,
        newPassword: dto.newPassword,
      });
      return UserResponseDto.fromDomain(user);
    } catch (error) {
      mapRegistrationOrPasswordError(error);
      throw error;
    }
  }
}
