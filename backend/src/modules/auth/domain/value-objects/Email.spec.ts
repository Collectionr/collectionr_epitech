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

  it.each([
    '',
    '   ',
    'not-an-email',
    'missing-domain@',
    '@missing-local.com',
    'no-at-sign.com',
    'a..b@example.com', // consecutive dots in the local part
    'user@example.com.', // trailing dot in the domain
    'a@b@c.com', // more than one @
    'user@localhost', // no TLD
    'user@[192.168.1.1]', // IP-literal domain, rejected by default
    `${'a'.repeat(65)}@example.com`, // local part over the 64-char RFC limit
  ])('rejects the invalid address "%s"', (raw) => {
    expect(() => Email.create(raw)).toThrow(/Invalid email address/);
  });

  it('rejects an address longer than 254 characters', () => {
    const tooLong = `${'a'.repeat(250)}@b.com`;

    expect(() => Email.create(tooLong)).toThrow(/Invalid email address/);
  });

  it('accepts a quoted local part', () => {
    expect(() => Email.create('"john doe"@example.com')).not.toThrow();
  });

  it('accepts an internationalized (IDN) domain', () => {
    expect(() => Email.create('user@exämple.com')).not.toThrow();
  });

  it('accepts plus-addressing in the local part', () => {
    expect(() => Email.create('user+tag@example.com')).not.toThrow();
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
