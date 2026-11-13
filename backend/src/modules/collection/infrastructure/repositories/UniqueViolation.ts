import { Prisma } from '../../../../generated/prisma/client.js';

/** Unique constraint violation (Prisma error code). */
const UNIQUE_VIOLATION = 'P2002';

/** The unique index that makes a collection name unique per owner, as PostgreSQL names it (see the migration). */
export const COLLECTION_NAME_UNIQUE = 'collections_userId_name_key';

/**
 * True when the error is a unique violation on the given index. This is the guarantee behind the
 * "one name per owner" rule: two concurrent requests that both pass any earlier look-up still end
 * up with one typed error instead of a 500.
 */
export function isUniqueViolationOn(error: unknown, constraint: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== UNIQUE_VIOLATION) {
    return false;
  }
  return (
    error.message.includes(constraint) || JSON.stringify(error.meta ?? {}).includes(constraint)
  );
}
