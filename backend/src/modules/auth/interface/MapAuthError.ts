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

/**
 * Translates the 6 domain/application errors of application/errors/AuthErrors.ts into the
 * matching NestJS HttpException, so AllExceptionsFilter can format them per ADR-006. Pure
 * presentation mapping (status code selection), not business logic — anything unrecognized is
 * left untouched for the caller to rethrow as-is (AllExceptionsFilter's generic 500 path).
 */
export function mapAuthError(error: unknown): void {
  if (error instanceof EmailAlreadyUsedError) {
    throw new ConflictException(error.message);
  }
  if (error instanceof InvalidCredentialsError) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof InvalidRefreshTokenError) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof UserNotFoundError) {
    throw new NotFoundException(error.message);
  }
  if (error instanceof IncorrectCurrentPasswordError) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof ConsentRequiredError) {
    throw new BadRequestException(error.message);
  }
}

/**
 * RegisterUserUseCase and ChangePasswordUseCase can also throw a plain `Error` — not one of the
 * 6 named AuthErrors — from the frozen domain's own input validation (Email.create, Password.create,
 * User's username check), which the DTOs' static class-validator decorators only approximate (e.g.
 * @MinLength(8) can't know the actually configured PASSWORD_MIN_LENGTH). Only these two use cases
 * can throw a bare Error this way, so treating whatever mapAuthError leaves unhandled as a 400 here
 * is safe — it would NOT be safe to apply this fallback to every auth error site.
 */
export function mapRegistrationOrPasswordError(error: unknown): void {
  mapAuthError(error);
  if (error instanceof Error) {
    throw new BadRequestException(error.message);
  }
}
