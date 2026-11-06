const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Guards every value that is about to reach a `@db.Uuid` column: PostgreSQL rejects a malformed
 * one with an error (a 500 for the caller), and `undefined` in a Prisma `where` is silently dropped,
 * widening the query to the whole table.
 */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
