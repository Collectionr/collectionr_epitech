import { Prisma } from '../../../../generated/prisma/client.js';

/** Foreign key violation (Prisma error code). */
const FOREIGN_KEY_VIOLATION = 'P2003';
/** Record to update or delete not found (Prisma error code). */
const RECORD_NOT_FOUND = 'P2025';

/** The foreign keys of the collection tables, as PostgreSQL names them (see the migration). */
export const COLLECTION_LICENCE_FK = 'collections_licenceTCGId_fkey';
export const ENTRY_COLLECTION_FK = 'card_entries_collectionId_fkey';
export const ENTRY_CARD_FK = 'card_entries_cardId_fkey';
export const ENTRY_VARIANT_FK = 'card_entries_cardId_variantId_fkey';

/**
 * True when the error is a foreign key violation on the given constraint. This is the backstop of
 * the explicit checks the repository makes inside its transactions: a row that disappears between
 * the check and the insert still ends up as a typed error instead of a 500.
 */
export function isForeignKeyViolationOn(error: unknown, constraint: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  if (error.code !== FOREIGN_KEY_VIOLATION) {
    return false;
  }
  return (
    error.message.includes(constraint) || JSON.stringify(error.meta ?? {}).includes(constraint)
  );
}

/** True when an update or delete targeted a row that does not exist (any more). */
export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === RECORD_NOT_FOUND;
}
