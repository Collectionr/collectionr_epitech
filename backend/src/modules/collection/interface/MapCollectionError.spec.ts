import {
  BadRequestException,
  ConflictException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { DomainValidationError as AuthDomainValidationError } from '../../auth/domain/errors/DomainValidationError';
import {
  CardEntryNotFoundError,
  CardNotFoundError,
  CollectionLimitReachedError,
  CollectionNameAlreadyUsedError,
  CollectionNotFoundError,
  LicenceNotFoundError,
} from '../application/errors/CollectionErrors';
import { DomainValidationError } from '../domain/errors/DomainValidationError';
import { mapCollectionError } from './MapCollectionError';

function messageOf(action: () => void): string {
  try {
    action();
  } catch (error) {
    return error instanceof HttpException ? error.message : String(error);
  }
  return '';
}

describe('mapCollectionError', () => {
  it('maps the collection module’s DomainValidationError to 400, keeping its message', () => {
    const error = new DomainValidationError('Quantity must be an integer');

    expect(() => mapCollectionError(error)).toThrow(BadRequestException);
    expect(messageOf(() => mapCollectionError(error))).toBe('Quantity must be an integer');
  });

  it.each([
    ['CollectionNotFoundError', new CollectionNotFoundError()],
    ['CardEntryNotFoundError', new CardEntryNotFoundError()],
    ['CardNotFoundError', new CardNotFoundError()],
    ['LicenceNotFoundError', new LicenceNotFoundError()],
  ])('maps %s to 404', (_name, error) => {
    expect(() => mapCollectionError(error)).toThrow(NotFoundException);
  });

  it('maps CollectionLimitReachedError to 409', () => {
    expect(() => mapCollectionError(new CollectionLimitReachedError())).toThrow(ConflictException);
  });

  it('maps CollectionNameAlreadyUsedError to 409', () => {
    expect(() => mapCollectionError(new CollectionNameAlreadyUsedError())).toThrow(
      ConflictException,
    );
  });

  it('does not turn the DomainValidationError of auth into a 400 (a different class: it is not this module’s)', () => {
    expect(() =>
      mapCollectionError(new AuthDomainValidationError('password too short')),
    ).not.toThrow();
  });

  it.each([
    ['a generic error', new Error('connect ECONNREFUSED postgres://user:secret@db:5432')],
    ['a non-error value', 'boom'],
    ['null', null],
  ])('leaves %s untouched, so that it stays a generic 500', (_label, error) => {
    expect(() => mapCollectionError(error)).not.toThrow();
  });
});
