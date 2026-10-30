import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './interface/controllers/AuthController';
import { UsersController } from './interface/controllers/UsersController';
import { JwtAuthGuard } from './interface/guards/JwtAuthGuard';
import { RedisRateLimitGuard } from './interface/guards/RedisRateLimitGuard';
import { RolesGuard } from './interface/guards/RolesGuard';
import { RegisterUserUseCase } from './application/use-cases/RegisterUserUseCase';
import { LoginUserUseCase } from './application/use-cases/LoginUserUseCase';
import { RefreshTokenUseCase } from './application/use-cases/RefreshTokenUseCase';
import { LogoutUserUseCase } from './application/use-cases/LogoutUserUseCase';
import { ChangePasswordUseCase } from './application/use-cases/ChangePasswordUseCase';
import { UpdateProfileUseCase } from './application/use-cases/UpdateProfileUseCase';
import { GetCurrentUserUseCase } from './application/use-cases/GetCurrentUserUseCase';
import { DeactivateUserUseCase } from './application/use-cases/DeactivateUserUseCase';
import { PurgeExpiredSessionsUseCase } from './application/use-cases/PurgeExpiredSessionsUseCase';
import { ACCESS_TOKEN_VERIFIER } from './application/ports/IAccessTokenVerifier';
import { USER_REPOSITORY } from './application/ports/IUserRepository';
import { USER_ROLE_RESOLVER } from './application/ports/IUserRoleResolver';
import { PrismaUserRoleResolver } from './infrastructure/repositories/PrismaUserRoleResolver';
import { PASSWORD_HASHER } from './application/ports/IPasswordHasher';
import { AUTH_TOKEN_SERVICE } from './application/ports/IAuthTokenService';
import { SESSION_PURGER } from './application/ports/ISessionPurger';
import { PASSWORD_MIN_LENGTH } from './application/ports/PasswordPolicy';
import { CURRENT_TERMS_VERSION } from './application/ports/TermsPolicy';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { AccessTokenVerifier } from './infrastructure/services/AccessTokenVerifier';
import { BcryptPasswordHasher } from './infrastructure/services/BcryptPasswordHasher';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JwtAuthTokenService,
  REFRESH_TOKEN_TTL_SECONDS,
  SESSION_MAX_LIFETIME_SECONDS,
} from './infrastructure/services/JwtAuthTokenService';
import { JwtTokenCodec } from './infrastructure/services/JwtTokenCodec';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';
import { RedisModule } from '../../shared/infrastructure/redis/RedisModule';

/**
 * Wires the Auth domain/application (COLLR-414) to concrete infrastructure and HTTP endpoints
 * (COLLR-415): Prisma-backed users/sessions, bcrypt hashing, JWT access/refresh tokens,
 * Redis-backed rate limiting on the auth routes (ADR-008).
 */
@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [AuthController, UsersController],
  providers: [
    RegisterUserUseCase,
    LoginUserUseCase,
    RefreshTokenUseCase,
    LogoutUserUseCase,
    ChangePasswordUseCase,
    UpdateProfileUseCase,
    GetCurrentUserUseCase,
    DeactivateUserUseCase,
    PurgeExpiredSessionsUseCase,
    JwtTokenCodec,
    JwtAuthGuard,
    RedisRateLimitGuard,
    RolesGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: USER_ROLE_RESOLVER, useClass: PrismaUserRoleResolver },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: AUTH_TOKEN_SERVICE, useClass: JwtAuthTokenService },
    // The same instance serves both ports: one class owns the sessions table.
    { provide: SESSION_PURGER, useExisting: AUTH_TOKEN_SERVICE },
    { provide: ACCESS_TOKEN_VERIFIER, useClass: AccessTokenVerifier },
    {
      provide: CURRENT_TERMS_VERSION,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): string =>
        configService.get<string>('TERMS_VERSION', '1'),
    },
    {
      provide: PASSWORD_MIN_LENGTH,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        configService.get<number>('PASSWORD_MIN_LENGTH', 8),
    },
    {
      provide: ACCESS_TOKEN_TTL_SECONDS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        configService.get<number>('JWT_ACCESS_TOKEN_TTL_SECONDS', 900),
    },
    {
      provide: REFRESH_TOKEN_TTL_SECONDS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        configService.get<number>('JWT_REFRESH_TOKEN_TTL_SECONDS', 604800),
    },
    {
      provide: SESSION_MAX_LIFETIME_SECONDS,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): number =>
        configService.get<number>('JWT_SESSION_MAX_LIFETIME_SECONDS', 2592000),
    },
  ],
  // What another module needs to put `@UseGuards(JwtAuthGuard)` on its own routes: Nest builds a
  // guard in the module of the controller that uses it, so the guard's dependency must be exported
  // with it (exporting the guard alone leaves the importing module unable to resolve it).
  exports: [JwtAuthGuard, RolesGuard, ACCESS_TOKEN_VERIFIER, USER_ROLE_RESOLVER],
})
export class AuthModule {}
