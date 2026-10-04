import { DomainValidationError } from '../errors/DomainValidationError';
import { Password } from './Password';

const DEFAULT_MIN_LENGTH = 8;

describe('Password', () => {
  it.each(['abcd1234', 'Sup3rSecret', 'a1'.repeat(36)])(
    'accepts the valid password "%s"',
    (raw) => {
      expect(() => Password.create(raw, DEFAULT_MIN_LENGTH)).not.toThrow();
    },
  );

  it('accepts a password made only of non-Latin letters and digits', () => {
    expect(() => Password.create('パスワード1234', DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it('accepts non-ASCII decimal digits (Arabic-Indic)', () => {
    expect(() => Password.create('abcdefg١٢', DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it('accepts a password with accented letters', () => {
    expect(() => Password.create('café12345', DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it('accepts a password containing a line break or spaces', () => {
    expect(() => Password.create('pass word\n1', DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it('keeps the original value', () => {
    expect(Password.create('abcd1234', DEFAULT_MIN_LENGTH).value).toBe('abcd1234');
  });

  it.each(['', 'a1', 'short1'])('rejects the too short password "%s"', (raw) => {
    expect(() => Password.create(raw, DEFAULT_MIN_LENGTH)).toThrow(/at least 8 characters/);
  });

  it('honors a stricter and a looser minLength than the default', () => {
    expect(() => Password.create('abcd1234', 12)).toThrow(/at least 12 characters/);
    expect(() => Password.create('a1234', 4)).not.toThrow();
  });

  it('rejects a password longer than 72 bytes', () => {
    expect(() => Password.create(`${'a1'.repeat(36)}xx`, DEFAULT_MIN_LENGTH)).toThrow(
      /at most 72 bytes/,
    );
  });

  it('rejects a password within 72 characters that exceeds 72 bytes once encoded', () => {
    // 'é' is 1 char but 2 UTF-8 bytes: 70 of them + 2 digits = 72 chars but 142 bytes.
    const multiByte = `${'é'.repeat(70)}12`;

    expect(multiByte).toHaveLength(72);
    expect(() => Password.create(multiByte, DEFAULT_MIN_LENGTH)).toThrow(/at most 72 bytes/);
  });

  it('accepts a password using the full 72-byte budget with multi-byte characters', () => {
    const atLimit = `${'é'.repeat(35)}12`;

    expect(Buffer.byteLength(atLimit, 'utf8')).toBe(72);
    expect(() => Password.create(atLimit, DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it('rejects a null byte (bcrypt implementations disagree on what follows it)', () => {
    expect(() => Password.create('abcd\u00001234', DEFAULT_MIN_LENGTH)).toThrow(/null character/);
  });

  it.each(['onlyletters', '12345678'])(
    'rejects the password "%s" for missing letter/digit complexity',
    (raw) => {
      expect(() => Password.create(raw, DEFAULT_MIN_LENGTH)).toThrow(
        /at least one letter and one digit/,
      );
    },
  );

  it.each([
    ['circled digit', 'abcdefgh①'],
    ['vulgar fraction', 'abcdefgh½'],
    ['superscript two', 'abcdefgh²'],
    ['roman numeral', 'abcdefghⅦ'],
  ])('does not count a %s as a digit', (_label, raw) => {
    expect(() => Password.create(raw, DEFAULT_MIN_LENGTH)).toThrow(
      /at least one letter and one digit/,
    );
  });

  it('reports user mistakes as DomainValidationError', () => {
    expect(() => Password.create('short', DEFAULT_MIN_LENGTH)).toThrow(DomainValidationError);
  });

  describe('misconfigured minLength fails closed', () => {
    it.each([undefined, null, Number.NaN, 0, -5, 8.5, '8', 'abc', Infinity])(
      'throws a plain Error (not a 4xx) for %p instead of skipping the length rule',
      (minLength) => {
        const attempt = (): Password => Password.create('a1', minLength as unknown as number);

        expect(attempt).toThrow(/Invalid password policy/);
        expect(attempt).not.toThrow(DomainValidationError);
      },
    );
  });
});
