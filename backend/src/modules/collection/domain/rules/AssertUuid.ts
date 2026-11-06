import { DomainValidationError } from '../errors/DomainValidationError';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Identifiers that come from a request (collection, entry, card, variant, licence) are database
 * UUIDs. A malformed one must stop here as a validation error (400): reaching a `@db.Uuid` column
 * it would be a PostgreSQL error, hence a 500 (S03 §5.3: identifiers are validated server side).
 * The label names the field in the message; the rejected value is never echoed.
 */
export function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new DomainValidationError(`${label} must be a valid UUID`);
  }
}
