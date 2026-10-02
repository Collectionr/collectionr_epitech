import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './interface/controllers/AuthController';
import { UsersController } from './interface/controllers/UsersController';
import { JwtAuthGuard } from './interface/guards/JwtAuthGuard';
import { RedisRateLimitGuard } from './interface/guards/RedisRateLimitGuard';
import { RegisterUserUseCase } from './application/use-cases/RegisterUserUseCase';
import { LoginUserUseCase } from './application/use-cases/LoginUserUseCase';
import { RefreshTokenUseCase } from './application/use-cases/RefreshTokenUseCase';
import { LogoutUserUseCase } from './application/use-cases/LogoutUserUseCase';
import { ChangePasswordUseCase } from './application/use-cases/ChangePasswordUseCase';
import { UpdateProfileUseCase } from './application/use-cases/UpdateProfileUseCase';
import { GetCurrentUserUseCase } from './application/use-cases/GetCurrentUserUseCase';
import { USER_REPOSITORY } from './application/ports/IUserRepository';
import { PASSWORD_HASHER } from './application/ports/IPasswordHasher';
import { AUTH_TOKEN_SERVICE } from './application/ports/IAuthTokenService';
import { PASSWORD_MIN_LENGTH } from './application/ports/PasswordPolicy';
import { PrismaUserRepository } from './infrastructure/repositories/PrismaUserRepository';
import { BcryptPasswordHasher } from './infrastructure/services/BcryptPasswordHasher';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  JwtAuthTokenService,
  REFRESH_TOKEN_TTL_SECONDS,
} from './infrastructure/services/JwtAuthTokenService';
import { JwtTokenCodec } from './infrastructure/services/JwtTokenCodec';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';
import { RedisModule } from '../../shared/infrastructure/redis/RedisModule';

/**
 * Wires the frozen Auth domain/application (COLLR-414) to concrete infrastructure and HTTP
 * endpoints (COLLR-415): Prisma-backed users/sessions, bcrypt hashing, JWT access/refresh tokens,
 * Redis-backed rate limiting on /auth/login and /auth/register (ADR-008).
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
    JwtTokenCodec,
    JwtAuthGuard,
    RedisRateLimitGuard,
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: AUTH_TOKEN_SERVICE, useClass: JwtAuthTokenService },
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
  ],
  // JwtAuthGuard is meant to protect routes in other (future) modules too.
  exports: [JwtAuthGuard],
})
export class AuthModule {}
