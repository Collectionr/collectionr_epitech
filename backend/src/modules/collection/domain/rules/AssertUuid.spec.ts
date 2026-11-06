import { randomUUID } from 'node:crypto';
import { assertUuid } from './AssertUuid';
import { DomainValidationError } from '../errors/DomainValidationError';

describe('assertUuid', () => {
  it('accepts a UUID, in lower or upper case', () => {
    const id = randomUUID();

    expect(() => assertUuid(id, 'Card id')).not.toThrow();
    expect(() => assertUuid(id.toUpperCase(), 'Card id')).not.toThrow();
  });

  it.each([
    '',
    ' ',
    'not-a-uuid',
    'collection-1',
    `${randomUUID()}x`,
    ` ${randomUUID()}`,
    "1' OR '1'='1",
  ])('rejects "%s" as a validation error', (value) => {
    expect(() => assertUuid(value, 'Card id')).toThrow(DomainValidationError);
    expect(() => assertUuid(value, 'Card id')).toThrow('Card id must be a valid UUID');
  });

  it('does not echo the rejected value', () => {
    expect(() => assertUuid('secret-value-123', 'Card id')).not.toThrow(/secret-value-123/);
  });
});
