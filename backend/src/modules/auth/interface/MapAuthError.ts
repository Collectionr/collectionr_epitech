import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
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

/**
 * Translates the application errors of application/errors/AuthErrors.ts into the matching NestJS
 * HttpException, so AllExceptionsFilter can format them per ADR-006. Pure presentation mapping
 * (status code selection), not business logic — anything unrecognized is left untouched for the
 * caller to rethrow as-is (AllExceptionsFilter's generic 500 path).
 *
 * Messages come from the errors themselves, and those are fixed strings: none of them echoes what the
 * caller submitted (an email, a username, an id).
 */
export function mapAuthError(error: unknown): void {
  if (error instanceof EmailAlreadyUsedError || error instanceof UsernameAlreadyUsedError) {
    throw new ConflictException(error.message);
  }
  if (error instanceof TermsVersionMismatchError) {
    throw new ConflictException(error.message);
  }
  if (error instanceof ConcurrentModificationError) {
    throw new ConflictException(error.message);
  }
  if (
    error instanceof InvalidCredentialsError ||
    error instanceof InvalidRefreshTokenError ||
    error instanceof IncorrectCurrentPasswordError
  ) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof UserNotFoundError) {
    throw new NotFoundException(error.message);
  }
  if (error instanceof ConsentRequiredError || error instanceof SamePasswordError) {
    throw new BadRequestException(error.message);
  }
}

/**
 * Registration and password change validate user-supplied values in the domain (Email, Password,
 * username), which the DTOs' static class-validator decorators only approximate. Only
 * DomainValidationError is safe to turn into a 400: its message never echoes the rejected value. Any
 * other error (Prisma, pg, config...) is a bug or an infrastructure failure and must stay a generic
 * 500 — its message can contain connection strings or SQL.
 */
export function mapRegistrationOrPasswordError(error: unknown): void {
  mapAuthError(error);
  if (error instanceof DomainValidationError) {
    throw new BadRequestException(error.message);
  }
}
