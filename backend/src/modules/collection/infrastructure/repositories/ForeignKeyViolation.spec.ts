import { Prisma } from '../../../../generated/prisma/client.js';
import {
  ENTRY_COLLECTION_FK,
  ENTRY_VARIANT_FK,
  isForeignKeyViolationOn,
  isRecordNotFound,
} from './ForeignKeyViolation';

function knownError(code: string, meta?: Record<string, unknown>, message = 'failed') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
    meta,
  });
}

describe('isForeignKeyViolationOn', () => {
  it('recognises the constraint named in the error metadata (the shape the pg adapter produces)', () => {
    const error = knownError('P2003', {
      driverAdapterError: { cause: { constraint: { index: ENTRY_COLLECTION_FK } } },
    });

    expect(isForeignKeyViolationOn(error, ENTRY_COLLECTION_FK)).toBe(true);
  });

  it('recognises the constraint named in the message', () => {
    const error = knownError(
      'P2003',
      undefined,
      `violated on the constraint: \`${ENTRY_VARIANT_FK}\``,
    );

    expect(isForeignKeyViolationOn(error, ENTRY_VARIANT_FK)).toBe(true);
  });

  it('does not take another constraint for the one asked about', () => {
    const error = knownError('P2003', { constraint: { index: ENTRY_COLLECTION_FK } });

    expect(isForeignKeyViolationOn(error, ENTRY_VARIANT_FK)).toBe(false);
  });

  it('ignores a Prisma error of another kind, even one naming the constraint', () => {
    const error = knownError('P2002', { constraint: { index: ENTRY_COLLECTION_FK } });

    expect(isForeignKeyViolationOn(error, ENTRY_COLLECTION_FK)).toBe(false);
  });

  it('ignores an error that is not a Prisma one', () => {
    expect(isForeignKeyViolationOn(new Error(ENTRY_COLLECTION_FK), ENTRY_COLLECTION_FK)).toBe(
      false,
    );
    expect(isForeignKeyViolationOn(undefined, ENTRY_COLLECTION_FK)).toBe(false);
  });
});

describe('isRecordNotFound', () => {
  it('recognises P2025 only', () => {
    expect(isRecordNotFound(knownError('P2025'))).toBe(true);
    expect(isRecordNotFound(knownError('P2003'))).toBe(false);
    expect(isRecordNotFound(new Error('P2025'))).toBe(false);
  });
});
