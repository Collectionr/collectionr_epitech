import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { DomainValidationError } from '../domain/errors/DomainValidationError';
import {
  ConcurrentModificationError,
  ConsentRequiredError,
  EmailAlreadyUsedError,
  IncorrectCurrentPasswordError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  SamePasswordError,
  TermsVersionMismatchError,
  UsernameAlreadyUsedError,
  UserNotFoundError,
} from '../application/errors/AuthErrors';
import { mapAuthError, mapRegistrationOrPasswordError } from './MapAuthError';

function messageOf(action: () => void): string {
  try {
    action();
  } catch (error) {
    return error instanceof HttpException ? error.message : String(error);
  }
  return '';
}

describe('mapAuthError', () => {
  it('maps EmailAlreadyUsedError to 409 Conflict', () => {
    expect(() => mapAuthError(new EmailAlreadyUsedError())).toThrow(ConflictException);
  });

  it('never echoes the submitted email in the 409 message', () => {
    const message = messageOf(() => mapAuthError(new EmailAlreadyUsedError()));

    expect(message).not.toContain('victim@example.com');
    expect(message.length).toBeGreaterThan(0);
  });

  it('maps InvalidCredentialsError to 401 Unauthorized', () => {
    expect(() => mapAuthError(new InvalidCredentialsError())).toThrow(UnauthorizedException);
  });

  it('maps InvalidRefreshTokenError to 401 Unauthorized', () => {
    expect(() => mapAuthError(new InvalidRefreshTokenError())).toThrow(UnauthorizedException);
  });

  it('maps UserNotFoundError to 404 Not Found without echoing the id', () => {
    const userId = 'b0b0b0b0-0000-4000-8000-000000000000';

    expect(() => mapAuthError(new UserNotFoundError())).toThrow(NotFoundException);
    expect(messageOf(() => mapAuthError(new UserNotFoundError()))).not.toContain(userId);
  });

  it('maps IncorrectCurrentPasswordError to 401 Unauthorized', () => {
    expect(() => mapAuthError(new IncorrectCurrentPasswordError())).toThrow(UnauthorizedException);
  });

  it('maps ConsentRequiredError to 400 Bad Request', () => {
    expect(() => mapAuthError(new ConsentRequiredError())).toThrow(BadRequestException);
  });

  it('maps ConcurrentModificationError to 409 Conflict', () => {
    expect(() => mapAuthError(new ConcurrentModificationError())).toThrow(ConflictException);
  });

  it('leaves an unrecognized error untouched (no throw)', () => {
    expect(() => mapAuthError(new Error('unexpected'))).not.toThrow();
  });
});

describe('mapAuthError: the terms and username errors', () => {
  it('maps a taken username to 409 with a fixed message', () => {
    expect(() => mapAuthError(new UsernameAlreadyUsedError())).toThrow(ConflictException);
    expect(messageOf(() => mapAuthError(new UsernameAlreadyUsedError()))).toBe(
      'Username is already taken',
    );
  });

  it('maps a stale terms version to 409 (the client must re-read the current terms)', () => {
    expect(() => mapAuthError(new TermsVersionMismatchError())).toThrow(ConflictException);
  });

  it('maps a same-password change to 400', () => {
    expect(() => mapAuthError(new SamePasswordError())).toThrow(BadRequestException);
  });

  it('maps a concurrent modification to 409', () => {
    expect(() => mapAuthError(new ConcurrentModificationError())).toThrow(ConflictException);
  });
});

describe('mapRegistrationOrPasswordError', () => {
  it('still maps the named AuthErrors', () => {
    expect(() => mapRegistrationOrPasswordError(new EmailAlreadyUsedError())).toThrow(
      ConflictException,
    );
  });

  it('maps a DomainValidationError to 400 with its (value-free) message', () => {
    expect(() =>
      mapRegistrationOrPasswordError(
        new DomainValidationError('Password must be at least 8 characters long'),
      ),
    ).toThrow(BadRequestException);
  });

  it('does NOT turn a Prisma error into a 400 carrying its message (stays a 500)', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.user.upsert()` invocation: connection to db.internal:5432 refused',
      { code: 'P1001', clientVersion: '7.10.0' },
    );

    expect(() => mapRegistrationOrPasswordError(prismaError)).not.toThrow();
  });

  it('turns a SamePasswordError into 400 through the registration/password path too', () => {
    expect(() => mapRegistrationOrPasswordError(new SamePasswordError())).toThrow(
      BadRequestException,
    );
  });

  it('does NOT turn an arbitrary Error (config, pg...) into a 400', () => {
    expect(() =>
      mapRegistrationOrPasswordError(new Error('JWT_SECRET is not defined')),
    ).not.toThrow();
  });

  it('leaves a non-Error value untouched (no throw)', () => {
    expect(() => mapRegistrationOrPasswordError('not an error')).not.toThrow();
  });
});
