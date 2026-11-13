import { Prisma } from '../../../../generated/prisma/client.js';
import { COLLECTION_NAME_UNIQUE, isUniqueViolationOn } from './UniqueViolation';

function knownError(code: string, meta?: Record<string, unknown>, message = 'failed') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('isUniqueViolationOn', () => {
  it('recognises the index named in the error metadata (the shape the pg adapter produces)', () => {
    const error = knownError('P2002', {
      driverAdapterError: { cause: { constraint: { index: COLLECTION_NAME_UNIQUE } } },
    });

    expect(isUniqueViolationOn(error, COLLECTION_NAME_UNIQUE)).toBe(true);
  });

  it('recognises the index named in the message', () => {
    const error = knownError(
      'P2002',
      undefined,
      `Unique constraint failed: ${COLLECTION_NAME_UNIQUE}`,
    );

    expect(isUniqueViolationOn(error, COLLECTION_NAME_UNIQUE)).toBe(true);
  });

  it('does not take another unique index for the one asked about', () => {
    const error = knownError('P2002', {
      driverAdapterError: { cause: { constraint: { index: 'collections_pkey' } } },
    });

    expect(isUniqueViolationOn(error, COLLECTION_NAME_UNIQUE)).toBe(false);
  });

  it('ignores other Prisma error codes, even naming the index', () => {
    const error = knownError('P2003', { constraint: { index: COLLECTION_NAME_UNIQUE } });

    expect(isUniqueViolationOn(error, COLLECTION_NAME_UNIQUE)).toBe(false);
  });

  it('ignores anything that is not a Prisma error', () => {
    expect(isUniqueViolationOn(new Error(COLLECTION_NAME_UNIQUE), COLLECTION_NAME_UNIQUE)).toBe(
      false,
    );
    expect(isUniqueViolationOn(undefined, COLLECTION_NAME_UNIQUE)).toBe(false);
  });
});
