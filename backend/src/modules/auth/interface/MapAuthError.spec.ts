import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ConsentRequiredError,
  EmailAlreadyUsedError,
  IncorrectCurrentPasswordError,
  InvalidCredentialsError,
  InvalidRefreshTokenError,
  UserNotFoundError,
} from '../application/errors/AuthErrors';
import { mapAuthError, mapRegistrationOrPasswordError } from './MapAuthError';

describe('mapAuthError', () => {
  it('maps EmailAlreadyUsedError to 409 Conflict', () => {
    expect(() => mapAuthError(new EmailAlreadyUsedError('a@b.com'))).toThrow(ConflictException);
  });

  it('maps InvalidCredentialsError to 401 Unauthorized', () => {
    expect(() => mapAuthError(new InvalidCredentialsError())).toThrow(UnauthorizedException);
  });

  it('maps InvalidRefreshTokenError to 401 Unauthorized', () => {
    expect(() => mapAuthError(new InvalidRefreshTokenError())).toThrow(UnauthorizedException);
  });

  it('maps UserNotFoundError to 404 Not Found', () => {
    expect(() => mapAuthError(new UserNotFoundError('id'))).toThrow(NotFoundException);
  });

  it('maps IncorrectCurrentPasswordError to 401 Unauthorized', () => {
    expect(() => mapAuthError(new IncorrectCurrentPasswordError())).toThrow(UnauthorizedException);
  });

  it('maps ConsentRequiredError to 400 Bad Request', () => {
    expect(() => mapAuthError(new ConsentRequiredError())).toThrow(BadRequestException);
  });

  it('leaves an unrecognized error untouched (no throw)', () => {
    expect(() => mapAuthError(new Error('unexpected'))).not.toThrow();
  });
});

describe('mapRegistrationOrPasswordError', () => {
  it('still maps the 6 named AuthErrors', () => {
    expect(() => mapRegistrationOrPasswordError(new EmailAlreadyUsedError('a@b.com'))).toThrow(
      ConflictException,
    );
  });

  it('maps a residual domain validation Error (e.g. Password.create) to 400', () => {
    expect(() =>
      mapRegistrationOrPasswordError(new Error('Password must be at least 8 characters long')),
    ).toThrow(BadRequestException);
  });

  it('leaves a non-Error value untouched (no throw)', () => {
    expect(() => mapRegistrationOrPasswordError('not an error')).not.toThrow();
  });
});
