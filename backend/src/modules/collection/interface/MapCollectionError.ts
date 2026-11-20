import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  CardEntryNotFoundError,
  CardNotFoundError,
  CollectionLimitReachedError,
  CollectionNameAlreadyUsedError,
  CollectionNotFoundError,
  LicenceNotFoundError,
} from '../application/errors/CollectionErrors';
import { DomainValidationError } from '../domain/errors/DomainValidationError';

/**
 * Translates the errors of the collection module into the matching NestJS HttpException, so
 * AllExceptionsFilter can format them per ADR-006. Pure presentation mapping (status code
 * selection), not business logic.
 *
 * It tests THIS module's DomainValidationError, which is a different class from the one of `auth`:
 * the auth mapper would not recognise it and it would end as a 500. Only that error is safe to
 * turn into a 400, its message never echoes the rejected value; the others carry fixed messages
 * too. Anything unrecognized (Prisma, pg, config...) is left untouched for the caller to rethrow,
 * and stays a generic 500: its message can contain connection strings or SQL.
 */
export function mapCollectionError(error: unknown): void {
  if (error instanceof DomainValidationError) {
    throw new BadRequestException(error.message);
  }
  if (
    error instanceof CollectionNotFoundError ||
    error instanceof CardEntryNotFoundError ||
    error instanceof CardNotFoundError ||
    error instanceof LicenceNotFoundError
  ) {
    throw new NotFoundException(error.message);
  }
  if (
    error instanceof CollectionLimitReachedError ||
    error instanceof CollectionNameAlreadyUsedError
  ) {
    throw new ConflictException(error.message);
  }
}
