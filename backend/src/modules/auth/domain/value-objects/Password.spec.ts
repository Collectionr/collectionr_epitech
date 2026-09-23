import { Password } from './Password';

describe('Password', () => {
  it.each(['abcd1234', 'Sup3rSecret', 'a1'.repeat(36)])(
    'accepts the valid password "%s"',
    (raw) => {
      expect(() => Password.create(raw)).not.toThrow();
    },
  );

  it('keeps the original value', () => {
    const password = Password.create('abcd1234');

    expect(password.value).toBe('abcd1234');
  });

  it.each(['', 'a1', 'short1'])('rejects the too short password "%s"', (raw) => {
    expect(() => Password.create(raw)).toThrow(/at least 8 characters/);
  });

  it('rejects a password longer than 72 characters', () => {
    const tooLong = `${'a1'.repeat(36)}xx`;

    expect(() => Password.create(tooLong)).toThrow(/at most 72 characters/);
  });

  it.each(['onlyletters', '12345678'])(
    'rejects the password "%s" for missing letter/digit complexity',
    (raw) => {
      expect(() => Password.create(raw)).toThrow(/at least one letter and one digit/);
    },
  );
});
