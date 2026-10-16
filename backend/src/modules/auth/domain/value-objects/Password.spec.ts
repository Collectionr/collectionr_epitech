import { DomainValidationError } from '../errors/DomainValidationError';
import { Password } from './Password';

const MIN = 8;
// What a bcrypt hasher would report; the domain itself knows no algorithm.
const MAX_BYTES = 72;

const create = (raw: string, minLength = MIN, maxBytes = MAX_BYTES): Password =>
  Password.create(raw, minLength, maxBytes);

describe('Password', () => {
  it.each(['abcd1234', 'Sup3rSecret', 'a1'.repeat(36)])(
    'accepts the valid password "%s"',
    (raw) => {
      expect(() => create(raw)).not.toThrow();
    },
  );

  it('accepts a password made only of non-Latin letters and digits', () => {
    expect(() => create('パスワード1234')).not.toThrow();
  });

  it('accepts non-ASCII decimal digits (Arabic-Indic)', () => {
    expect(() => create('abcdefg١٢')).not.toThrow();
  });

  it('accepts a password with accented letters', () => {
    expect(() => create('café12345')).not.toThrow();
  });

  it('accepts a password containing a line break or spaces', () => {
    expect(() => create('pass word\n1')).not.toThrow();
  });

  it('keeps the original value', () => {
    expect(create('abcd1234').value).toBe('abcd1234');
  });

  it.each(['', 'a1', 'short1'])('rejects the too short password "%s"', (raw) => {
    expect(() => create(raw)).toThrow(/at least 8 characters/);
  });

  it('honors a stricter and a looser minLength than the default', () => {
    expect(() => create('abcd1234', 12)).toThrow(/at least 12 characters/);
    expect(() => create('a1234', 4)).not.toThrow();
  });

  describe('maximum size, set by the hasher', () => {
    it('rejects a password longer than the given number of bytes', () => {
      expect(() => create(`${'a1'.repeat(36)}xx`)).toThrow(/at most 72 bytes/);
    });

    it('follows the limit it is given instead of a built-in one', () => {
      expect(() => create('abcd1234efgh', MIN, 10)).toThrow(/at most 10 bytes/);
      expect(() => create(`${'a1'.repeat(100)}`, MIN, 1024)).not.toThrow();
    });

    it('counts bytes, not characters (multi-byte characters)', () => {
      // 'é' is 1 char but 2 UTF-8 bytes: 70 of them + 2 digits = 72 chars but 142 bytes.
      const multiByte = `${'é'.repeat(70)}12`;

      expect(multiByte).toHaveLength(72);
      expect(() => create(multiByte)).toThrow(/at most 72 bytes/);
    });

    it('accepts a password using exactly the byte budget with multi-byte characters', () => {
      const atLimit = `${'é'.repeat(35)}12`;

      expect(Buffer.byteLength(atLimit, 'utf8')).toBe(72);
      expect(() => create(atLimit)).not.toThrow();
    });
  });

  it('rejects a null byte (hashing implementations disagree on what follows it)', () => {
    expect(() => create('abcd\u00001234')).toThrow(/null character/);
  });

  it.each(['onlyletters', '12345678'])(
    'rejects the password "%s" for missing letter/digit complexity',
    (raw) => {
      expect(() => create(raw)).toThrow(/at least one letter and one digit/);
    },
  );

  it.each([
    ['circled digit', 'abcdefgh①'],
    ['vulgar fraction', 'abcdefgh½'],
    ['superscript two', 'abcdefgh²'],
    ['roman numeral', 'abcdefghⅦ'],
  ])('does not count a %s as a digit', (_label, raw) => {
    expect(() => create(raw)).toThrow(/at least one letter and one digit/);
  });

  it('reports user mistakes as DomainValidationError', () => {
    expect(() => create('short')).toThrow(DomainValidationError);
  });

  describe('a misconfigured policy fails closed', () => {
    const bad = [undefined, null, Number.NaN, 0, -5, 8.5, '8', 'abc', Infinity];

    it.each(bad)('throws a plain Error (not a 4xx) for minLength %p', (minLength) => {
      // Password.create directly: the local helper's default values would replace `undefined`.
      const attempt = (): Password =>
        Password.create('a1', minLength as unknown as number, MAX_BYTES);

      expect(attempt).toThrow(/Invalid password policy: minLength/);
      expect(attempt).not.toThrow(DomainValidationError);
    });

    it.each(bad)('throws a plain Error (not a 4xx) for maxBytes %p', (maxBytes) => {
      const attempt = (): Password =>
        Password.create('abcd1234', MIN, maxBytes as unknown as number);

      expect(attempt).toThrow(/Invalid password policy: maxBytes/);
      expect(attempt).not.toThrow(DomainValidationError);
    });
  });
});
