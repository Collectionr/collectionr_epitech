import 'reflect-metadata';
import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { Prisma } from '../../../../generated/prisma/client.js';
import { readAuditSubject } from '../../../audit/interface/AuditRequestContext';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { User } from '../../domain/entities/User';
import { toUserProfile } from '../../application/dtos/UserProfile';
import { Email } from '../../domain/value-objects/Email';
import {
  EmailAlreadyUsedError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
} from '../../application/errors/AuthErrors';
import type { RegisterUserUseCase } from '../../application/use-cases/RegisterUserUseCase';
import type { LoginUserUseCase } from '../../application/use-cases/LoginUserUseCase';
import type { RefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase';
import type { LogoutUserUseCase } from '../../application/use-cases/LogoutUserUseCase';
import { RATE_LIMIT_METADATA_KEY } from '../decorators/RateLimit';
import type { RateLimitOptions } from '../decorators/RateLimit';
import { AuthController } from './AuthController';

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

const request = (): FastifyRequest => ({}) as FastifyRequest;

const validRegistration = {
  email: 'trainer@example.com',
  password: 'Str0ngPassw0rd!',
  username: 'ash',
  hasAcceptedTerms: true,
};

describe('AuthController', () => {
  describe('register', () => {
    it('maps the created user to a response DTO', async () => {
      const user = buildUser();
      const controller = buildController({
        register: { execute: jest.fn().mockResolvedValue(toUserProfile(user)) },
      });

      const dto = await controller.register(
        { ...validRegistration, email: user.email.value, username: user.username },
        request(),
      );

      expect(dto.email).toBe(user.email.value);
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('declares the new user as actor and target of the audit entry, with only the canonical email as metadata', async () => {
      const user = buildUser();
      const req = request();
      const controller = buildController({
        register: { execute: jest.fn().mockResolvedValue(toUserProfile(user)) },
      });

      await controller.register({ ...validRegistration, email: '  Trainer@EXAMPLE.com ' }, req);

      expect(readAuditSubject(req)).toEqual({
        actorId: user.id,
        targetId: user.id,
        metadata: { email: 'trainer@example.com' },
      });
    });

    it('still records the attempted email when registration fails (and no actor)', async () => {
      const req = request();
      const controller = buildController({
        register: { execute: jest.fn().mockRejectedValue(new EmailAlreadyUsedError('x@y.com')) },
      });

      await expect(controller.register(validRegistration, req)).rejects.toThrow(ConflictException);

      expect(readAuditSubject(req)).toEqual({ metadata: { email: 'trainer@example.com' } });
    });

    it('answers 409 without echoing the submitted email', async () => {
      const controller = buildController({
        register: {
          execute: jest.fn().mockRejectedValue(new EmailAlreadyUsedError('trainer@example.com')),
        },
      });

      const failure = await controller
        .register(validRegistration, request())
        .catch((error: Error) => error);

      expect(failure).toBeInstanceOf(ConflictException);
      expect((failure as Error).message).not.toContain('trainer@example.com');
    });

    it('maps a DomainValidationError to 400 Bad Request', async () => {
      const controller = buildController({
        register: {
          execute: jest
            .fn()
            .mockRejectedValue(
              new DomainValidationError('Password must be at least 8 characters long'),
            ),
        },
      });

      await expect(controller.register(validRegistration, request())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does NOT turn an infrastructure failure into a 400 that leaks its message', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Invalid `prisma.user.upsert()` invocation: connect ECONNREFUSED db.internal:5432',
        { code: 'P1001', clientVersion: '7.10.0' },
      );
      const controller = buildController({
        register: { execute: jest.fn().mockRejectedValue(prismaError) },
      });

      await expect(controller.register(validRegistration, request())).rejects.toBe(prismaError);
    });
  });

  describe('responses never carry a secret, whatever the use case hands over', () => {
    it('register exposes only the public fields of the profile', async () => {
      const user = buildUser();
      const leaky = { ...toUserProfile(user), passwordHash: 'must-not-appear' };
      const controller = buildController({
        register: { execute: jest.fn().mockResolvedValue(leaky) },
      });

      const dto = await controller.register(validRegistration, request());

      expect(JSON.stringify(dto)).not.toContain('must-not-appear');
      expect(dto).not.toHaveProperty('passwordHash');
    });

    it('login exposes only the public fields of the profile', async () => {
      const user = buildUser();
      const leaky = { ...toUserProfile(user), passwordHash: 'must-not-appear' };
      const controller = buildController({
        login: {
          execute: jest
            .fn()
            .mockResolvedValue({ user: leaky, tokens: { accessToken: 'a', refreshToken: 'r' } }),
        },
      });

      const dto = await controller.login({ email: 'a@b.com', password: 'x' }, request());

      expect(JSON.stringify(dto)).not.toContain('must-not-appear');
    });
  });

  describe('login', () => {
    it('returns the user and tokens', async () => {
      const user = buildUser();
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      const controller = buildController({
        login: { execute: jest.fn().mockResolvedValue({ user: toUserProfile(user), tokens }) },
      });

      const dto = await controller.login(
        { email: user.email.value, password: 'Str0ngPassw0rd!' },
        request(),
      );

      expect(dto.user.email).toBe(user.email.value);
      expect(dto.accessToken).toBe('access');
      expect(dto.refreshToken).toBe('refresh');
    });

    it('declares the logged-in user as actor and target of the audit entry', async () => {
      const user = buildUser();
      const req = request();
      const controller = buildController({
        login: {
          execute: jest.fn().mockResolvedValue({
            user: toUserProfile(user),
            tokens: { accessToken: 'a', refreshToken: 'r' },
          }),
        },
      });

      await controller.login({ email: user.email.value, password: 'x' }, req);

      expect(readAuditSubject(req)).toEqual({
        actorId: user.id,
        targetId: user.id,
        metadata: { email: user.email.value },
      });
    });

    it('records the attempted email, truncated, and no actor when the login fails', async () => {
      const req = request();
      const controller = buildController({
        login: { execute: jest.fn().mockRejectedValue(new InvalidCredentialsError()) },
      });

      await expect(
        controller.login({ email: `${'a'.repeat(5000)}@example.com`, password: 'x' }, req),
      ).rejects.toThrow(UnauthorizedException);

      const subject = readAuditSubject(req);
      expect(subject.actorId).toBeUndefined();
      expect(String(subject.metadata?.email).length).toBeLessThanOrEqual(254);
    });

    it('maps InvalidCredentialsError to 401 Unauthorized', async () => {
      const controller = buildController({
        login: { execute: jest.fn().mockRejectedValue(new InvalidCredentialsError()) },
      });

      await expect(
        controller.login({ email: 'a@b.com', password: 'wrong' }, request()),
      ).rejects.toThrow(UnauthorizedException);
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

    it('maps InvalidRefreshTokenError to 401 Unauthorized', async () => {
      const controller = buildController({
        refresh: { execute: jest.fn().mockRejectedValue(new InvalidRefreshTokenError()) },
      });

      await expect(controller.refresh({ refreshToken: 'x' })).rejects.toThrow(
        UnauthorizedException,
      );
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

  describe('route protection', () => {
    function rateLimitOf(handler: keyof AuthController): RateLimitOptions | undefined {
      return Reflect.getMetadata(RATE_LIMIT_METADATA_KEY, AuthController.prototype[handler]) as
        RateLimitOptions | undefined;
    }

    it.each(['register', 'login', 'refresh', 'logout'] as const)(
      'rate-limits %s (none of the auth routes is unauthenticated AND unlimited)',
      (handler) => {
        expect(rateLimitOf(handler)?.rules.length).toBeGreaterThan(0);
      },
    );

    it('limits a login per account as well as per address, and fails closed', () => {
      const login = rateLimitOf('login');

      expect(login?.rules.map((rule) => rule.scope)).toEqual(
        expect.arrayContaining(['ip-account', 'account', 'ip']),
      );
      expect(login?.onRedisFailure).toBe('deny');
    });

    it.each(['login', 'refresh'] as const)(
      'forbids caching of the %s response, which carries tokens',
      (handler) => {
        const headers = Reflect.getMetadata('__headers__', AuthController.prototype[handler]) as {
          name: string;
          value: string;
        }[];

        expect(headers).toContainEqual({ name: 'Cache-Control', value: 'no-store' });
      },
    );
  });
});
