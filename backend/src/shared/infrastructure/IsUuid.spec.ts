import { randomUUID } from 'node:crypto';
import { isUuid } from './IsUuid';

describe('isUuid', () => {
  it('accepts a UUID, in either case', () => {
    const id = randomUUID();

    expect(isUuid(id)).toBe(true);
    expect(isUuid(id.toUpperCase())).toBe(true);
  });

  it.each([undefined, null, 12, {}, [], '', 'not-a-uuid', `${randomUUID()}x`, ` ${randomUUID()}`])(
    'rejects %p',
    (value) => {
      expect(isUuid(value)).toBe(false);
    },
  );
});
