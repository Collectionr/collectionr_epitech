import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from './AuthController';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import {
  EmailAlreadyUsedError,
  InvalidCredentialsError,
} from '../../application/errors/AuthErrors';
import type { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import type { LoginUserUseCase } from '../../application/use-cases/LoginUserUseCase';
import type { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase';
import type { LogoutUserUseCase } from '../../application/use-cases/LogoutUserUseCase';

function buildUser(): User {
  return User.register({
    email: Email.create('trainer@example.com'),
    passwordHash: 'hashed',
    username: 'ash_ketchum',
    consentGivenAt: new Date(),
  });
}

function buildController(overrides: {
  register?: Partial<RegisterUserUseCase>;
  login?: Partial<LoginUserUseCase>;
  refresh?: Partial<RefreshTokenUseCase>;
  logout?: Partial<LogoutUserUseCase>;
}): AuthController {
  return new AuthController(
    (overrides.register ?? { execute: jest.fn() }) as RegisterUserUseCase,
    (overrides.login ?? { execute: jest.fn() }) as LoginUserUseCase,
    (overrides.refresh ?? { execute: jest.fn() }) as RefreshTokenUseCase,
    (overrides.logout ?? { execute: jest.fn() }) as LogoutUserUseCase,
  );
}

describe('AuthController', () => {
  describe('register', () => {
    it('maps the created user to a response DTO', async () => {
      const user = buildUser();
      const controller = buildController({
        register: { execute: jest.fn().mockResolvedValue(user) },
      });

      const dto = await controller.register({
        email: user.email.value,
        password: 'Str0ngPassw0rd!',
        username: user.username,
        hasAcceptedTerms: true,
      });

      expect(dto.email).toBe(user.email.value);
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('maps EmailAlreadyUsedError to 409 Conflict', async () => {
      const controller = buildController({
        register: {
          execute: jest.fn().mockRejectedValue(new EmailAlreadyUsedError('trainer@example.com')),
        },
      });

      await expect(
        controller.register({
          email: 'trainer@example.com',
          password: 'Str0ngPassw0rd!',
          username: 'ash',
          hasAcceptedTerms: true,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('maps a residual domain validation error to 400 Bad Request', async () => {
      const controller = buildController({
        register: {
          execute: jest
            .fn()
            .mockRejectedValue(new Error('Password must be at least 8 characters long')),
        },
      });

      await expect(
        controller.register({
          email: 'trainer@example.com',
          password: 'short',
          username: 'ash',
          hasAcceptedTerms: true,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('returns the user and tokens', async () => {
      const user = buildUser();
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      const controller = buildController({
        login: { execute: jest.fn().mockResolvedValue({ user, tokens }) },
      });

      const dto = await controller.login({ email: user.email.value, password: 'Str0ngPassw0rd!' });

      expect(dto.user.email).toBe(user.email.value);
      expect(dto.accessToken).toBe('access');
      expect(dto.refreshToken).toBe('refresh');
    });

    it('maps InvalidCredentialsError to 401 Unauthorized', async () => {
      const controller = buildController({
        login: { execute: jest.fn().mockRejectedValue(new InvalidCredentialsError()) },
      });

      await expect(controller.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refresh', () => {
    it('returns the rotated token pair', async () => {
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      const controller = buildController({
        refresh: { execute: jest.fn().mockResolvedValue(tokens) },
      });

      const dto = await controller.refresh({ refreshToken: 'old-refresh' });

      expect(dto).toEqual(tokens);
    });
  });

  describe('logout', () => {
    it('delegates to LogoutUserUseCase', async () => {
      const execute = jest.fn().mockResolvedValue(undefined);
      const controller = buildController({ logout: { execute } });

      await controller.logout({ refreshToken: 'a-refresh-token' });

      expect(execute).toHaveBeenCalledWith({ refreshToken: 'a-refresh-token' });
    });
  });
});
