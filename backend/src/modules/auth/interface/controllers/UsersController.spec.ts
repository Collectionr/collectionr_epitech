import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Prisma } from '../../../../generated/prisma/client.js';
import { readAuditSubject } from '../../../audit/interface/AuditRequestContext';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { User } from '../../domain/entities/User';
import { Email } from '../../domain/value-objects/Email';
import {
  ConcurrentModificationError,
  IncorrectCurrentPasswordError,
  UserNotFoundError,
} from '../../application/errors/AuthErrors';
import type { GetCurrentUserUseCase } from '../../application/use-cases/GetCurrentUserUseCase';
import type { ChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase';
import type { UpdateProfileUseCase } from '../../application/use-cases/UpdateProfileUseCase';
import { RATE_LIMIT_METADATA_KEY } from '../decorators/RateLimit';
import type { RateLimitOptions } from '../decorators/RateLimit';
import { JwtAuthGuard } from '../guards/JwtAuthGuard';
import { UsersController } from './UsersController';

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
  updateProfile?: Partial<UpdateProfileUseCase>;
}): UsersController {
  return new UsersController(
    (overrides.getCurrentUser ?? { execute: jest.fn() }) as GetCurrentUserUseCase,
    (overrides.changePassword ?? { execute: jest.fn() }) as ChangePasswordUseCase,
    (overrides.updateProfile ?? { execute: jest.fn() }) as UpdateProfileUseCase,
  );
}

const request = (): FastifyRequest => ({}) as FastifyRequest;

/** The route handler function, as Reflect metadata is attached to it (typed away from `unbound-method`). */
const handlerOf = (name: keyof UsersController): object =>
  (UsersController.prototype as unknown as Record<string, object>)[name];
const passwords = { currentPassword: 'OldPassw0rd!', newPassword: 'NewPassw0rd!' };

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

    it('answers 404 when the account is gone', async () => {
      const controller = buildController({
        getCurrentUser: { execute: jest.fn().mockRejectedValue(new UserNotFoundError('user-1')) },
      });

      await expect(controller.getMe({ id: 'user-1' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates the username and returns the profile', async () => {
      const user = buildUser();
      const execute = jest.fn().mockResolvedValue(user.withUsername('new_name'));
      const controller = buildController({ updateProfile: { execute } });

      const dto = await controller.updateProfile({ id: user.id }, { username: 'new_name' });

      expect(execute).toHaveBeenCalledWith({ userId: user.id, username: 'new_name' });
      expect(dto.username).toBe('new_name');
    });

    it('maps a DomainValidationError to 400 and a lost race to 409', async () => {
      const invalid = buildController({
        updateProfile: {
          execute: jest.fn().mockRejectedValue(new DomainValidationError('Username must be...')),
        },
      });
      const raced = buildController({
        updateProfile: { execute: jest.fn().mockRejectedValue(new ConcurrentModificationError()) },
      });

      await expect(invalid.updateProfile({ id: 'u' }, { username: 'ab' })).rejects.toThrow(
        BadRequestException,
      );
      await expect(raced.updateProfile({ id: 'u' }, { username: 'abc' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('changePassword', () => {
    it('returns the updated user profile', async () => {
      const user = buildUser();
      const controller = buildController({
        changePassword: { execute: jest.fn().mockResolvedValue(user) },
      });

      const dto = await controller.changePassword({ id: user.id }, passwords, request());

      expect(dto.id).toBe(user.id);
    });

    it('declares the user as the target of the audit entry (no id in the route)', async () => {
      const user = buildUser();
      const req = request();
      const controller = buildController({
        changePassword: { execute: jest.fn().mockResolvedValue(user) },
      });

      await controller.changePassword({ id: user.id }, passwords, req);

      expect(readAuditSubject(req)).toEqual({ targetId: user.id });
    });

    it('maps IncorrectCurrentPasswordError to 401 Unauthorized', async () => {
      const controller = buildController({
        changePassword: {
          execute: jest.fn().mockRejectedValue(new IncorrectCurrentPasswordError()),
        },
      });

      await expect(
        controller.changePassword({ id: 'user-1' }, passwords, request()),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('maps a DomainValidationError (policy, same password...) to 400 Bad Request', async () => {
      const controller = buildController({
        changePassword: {
          execute: jest
            .fn()
            .mockRejectedValue(new DomainValidationError('The new password must differ')),
        },
      });

      await expect(
        controller.changePassword({ id: 'user-1' }, passwords, request()),
      ).rejects.toThrow(BadRequestException);
    });

    it('does NOT turn a Prisma error into a 400 that carries its message', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Invalid `prisma...` invocation',
        { code: 'P2034', clientVersion: '7.10.0' },
      );
      const controller = buildController({
        changePassword: { execute: jest.fn().mockRejectedValue(prismaError) },
      });

      await expect(controller.changePassword({ id: 'user-1' }, passwords, request())).rejects.toBe(
        prismaError,
      );
    });
  });

  describe('route protection', () => {
    it('authenticates every route of the controller', () => {
      const guards = Reflect.getMetadata('__guards__', UsersController) as unknown[];

      expect(guards).toContain(JwtAuthGuard);
    });

    it('rate-limits a password change per user, and fails closed', () => {
      const options = Reflect.getMetadata(
        RATE_LIMIT_METADATA_KEY,
        handlerOf('changePassword'),
      ) as RateLimitOptions;

      expect(options.rules.map((rule) => rule.scope)).toEqual(['user']);
      expect(options.onRedisFailure).toBe('deny');
    });

    it('forbids caching of the profile', () => {
      const headers = Reflect.getMetadata('__headers__', handlerOf('getMe')) as {
        name: string;
        value: string;
      }[];

      expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
    });
  });
});
