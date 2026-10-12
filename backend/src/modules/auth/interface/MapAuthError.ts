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
  UserNotFoundError,
} from '../application/errors/AuthErrors';

/**
 * Translates the application errors of application/errors/AuthErrors.ts into the matching NestJS
 * HttpException, so AllExceptionsFilter can format them per ADR-006. Pure presentation mapping
 * (status code selection), not business logic — anything unrecognized is left untouched for the
 * caller to rethrow as-is (AllExceptionsFilter's generic 500 path).
 *
 * Messages are fixed strings on purpose: some error messages embed what the caller submitted (the
 * email, a user id), and a response must never echo it back.
 */
export function mapAuthError(error: unknown): void {
  if (error instanceof EmailAlreadyUsedError) {
    throw new ConflictException('Email is already registered');
  }
  if (error instanceof InvalidCredentialsError) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof InvalidRefreshTokenError) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof UserNotFoundError) {
    throw new NotFoundException('User not found');
  }
  if (error instanceof IncorrectCurrentPasswordError) {
    throw new UnauthorizedException(error.message);
  }
  if (error instanceof ConsentRequiredError) {
    throw new BadRequestException(error.message);
  }
  if (error instanceof ConcurrentModificationError) {
    throw new ConflictException(error.message);
  }
}

/**
 * Registration and password change validate user-supplied values in the domain (Email, Password,
 * username), which the DTOs' static class-validator decorators only approximate (e.g.
 * @MinLength(8) can't know the configured PASSWORD_MIN_LENGTH). Only DomainValidationError is safe
 * to turn into a 400: its message never echoes the rejected value. Any other error (Prisma, pg,
 * config...) is a bug or an infrastructure failure and must stay a generic 500 — its message can
 * contain connection strings or SQL.
 */
export function mapRegistrationOrPasswordError(error: unknown): void {
  mapAuthError(error);
  if (error instanceof DomainValidationError) {
    throw new BadRequestException(error.message);
  }
}
