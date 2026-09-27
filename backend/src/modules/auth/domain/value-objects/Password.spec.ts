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

  it('accepts a password with accented letters', () => {
    expect(() => Password.create('café12345', DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it('keeps the original value', () => {
    const password = Password.create('abcd1234', DEFAULT_MIN_LENGTH);

    expect(password.value).toBe('abcd1234');
  });

  it.each(['', 'a1', 'short1'])('rejects the too short password "%s"', (raw) => {
    expect(() => Password.create(raw, DEFAULT_MIN_LENGTH)).toThrow(/at least 8 characters/);
  });

  it('honors a stricter minLength than the default', () => {
    expect(() => Password.create('abcd1234', 12)).toThrow(/at least 12 characters/);
  });

  it('honors a looser minLength than the default', () => {
    expect(() => Password.create('a1234', 4)).not.toThrow();
  });

  it('rejects a password longer than 72 bytes', () => {
    const tooLong = `${'a1'.repeat(36)}xx`;

    expect(() => Password.create(tooLong, DEFAULT_MIN_LENGTH)).toThrow(/at most 72 bytes/);
  });

  it('rejects a password that is within 72 characters but exceeds 72 bytes once encoded (multi-byte chars)', () => {
    // 'é' is 1 char but 2 UTF-8 bytes: 70 of them + 2 digits = 72 chars but 142 bytes.
    const multiByte = `${'é'.repeat(70)}12`;

    expect(multiByte).toHaveLength(72);
    expect(() => Password.create(multiByte, DEFAULT_MIN_LENGTH)).toThrow(/at most 72 bytes/);
  });

  it('accepts a password using the full 72-byte budget with multi-byte characters', () => {
    // 35 'é' (70 bytes) + 2 ASCII digits = 72 bytes exactly.
    const atLimit = `${'é'.repeat(35)}12`;

    expect(Buffer.byteLength(atLimit, 'utf8')).toBe(72);
    expect(() => Password.create(atLimit, DEFAULT_MIN_LENGTH)).not.toThrow();
  });

  it.each(['onlyletters', '12345678'])(
    'rejects the password "%s" for missing letter/digit complexity',
    (raw) => {
      expect(() => Password.create(raw, DEFAULT_MIN_LENGTH)).toThrow(
        /at least one letter and one digit/,
      );
    },
  );
});
