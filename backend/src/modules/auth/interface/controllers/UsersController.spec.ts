import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { UsersController } from './UsersController';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import { IncorrectCurrentPasswordError } from '../../application/errors/AuthErrors';
import type { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase';
import type { ChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase';

function buildUser(): User {
  return User.register({
    email: Email.create('trainer@example.com'),
    passwordHash: 'hashed',
    username: 'ash_ketchum',
    consentGivenAt: new Date(),
  });
}

function buildController(overrides: {
  getCurrentUser?: Partial<GetCurrentUserUseCase>;
  changePassword?: Partial<ChangePasswordUseCase>;
}): UsersController {
  return new UsersController(
    (overrides.getCurrentUser ?? { execute: jest.fn() }) as GetCurrentUserUseCase,
    (overrides.changePassword ?? { execute: jest.fn() }) as ChangePasswordUseCase,
  );
}

describe('UsersController', () => {
  describe('getMe', () => {
    it('returns the current user profile', async () => {
      const user = buildUser();
      const controller = buildController({
        getCurrentUser: { execute: jest.fn().mockResolvedValue(user) },
      });

      const dto = await controller.getMe({ id: user.id });

      expect(dto.id).toBe(user.id);
      expect(dto.email).toBe(user.email.value);
    });
  });

  describe('changePassword', () => {
    it('returns the updated user profile', async () => {
      const user = buildUser();
      const controller = buildController({
        changePassword: { execute: jest.fn().mockResolvedValue(user) },
      });

      const dto = await controller.changePassword(
        { id: user.id },
        { currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!' },
      );

      expect(dto.id).toBe(user.id);
    });

    it('maps IncorrectCurrentPasswordError to 401 Unauthorized', async () => {
      const controller = buildController({
        changePassword: {
          execute: jest.fn().mockRejectedValue(new IncorrectCurrentPasswordError()),
        },
      });

      await expect(
        controller.changePassword(
          { id: 'user-1' },
          { currentPassword: 'wrong', newPassword: 'NewPassw0rd!' },
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('maps a residual domain validation error to 400 Bad Request', async () => {
      const controller = buildController({
        changePassword: {
          execute: jest
            .fn()
            .mockRejectedValue(new Error('Password must be at least 8 characters long')),
        },
      });

      await expect(
        controller.changePassword(
          { id: 'user-1' },
          { currentPassword: 'OldPassw0rd!', newPassword: 'x' },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
