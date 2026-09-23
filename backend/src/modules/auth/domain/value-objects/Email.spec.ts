import { Email } from './Email';

describe('Email', () => {
  it.each(['user@example.com', 'first.last+tag@sub.example.co', 'a@b.io'])(
    'accepts the valid address "%s"',
    (raw) => {
      expect(() => Email.create(raw)).not.toThrow();
    },
  );

  it('normalizes casing and surrounding whitespace', () => {
    const email = Email.create('  User@Example.COM  ');

    expect(email.value).toBe('user@example.com');
  });

  it.each(['', '   ', 'not-an-email', 'missing-domain@', '@missing-local.com', 'no-at-sign.com'])(
    'rejects the invalid address "%s"',
    (raw) => {
      expect(() => Email.create(raw)).toThrow(/Invalid email address/);
    },
  );

  it('rejects an address longer than 254 characters', () => {
    const tooLong = `${'a'.repeat(250)}@b.com`;

    expect(() => Email.create(tooLong)).toThrow(/Invalid email address/);
  });

  it('considers two addresses equal regardless of casing', () => {
    const first = Email.create('user@example.com');
    const second = Email.create('USER@EXAMPLE.COM');

    expect(first.equals(second)).toBe(true);
  });

  it('exposes the normalized value via toString', () => {
    const email = Email.create('User@Example.com');

    expect(email.toString()).toBe('user@example.com');
  });
});
