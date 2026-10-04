import { DomainValidationError } from '../errors/DomainValidationError';
import { Email } from './Email';

describe('Email', () => {
  it.each(['user@example.com', 'first.last+tag@sub.example.co', 'a@b.io'])(
    'accepts the valid address "%s"',
    (raw) => {
      expect(() => Email.create(raw)).not.toThrow();
    },
  );

  it('normalizes casing and surrounding whitespace', () => {
    expect(Email.create('  User@Example.COM  ').value).toBe('user@example.com');
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
    expect(() => Email.create(raw)).toThrow(DomainValidationError);
    expect(() => Email.create(raw)).toThrow(/Invalid email address/);
  });

  it('rejects an address longer than 254 characters', () => {
    expect(() => Email.create(`${'a'.repeat(250)}@b.com`)).toThrow(DomainValidationError);
  });

  it('never echoes the rejected value in the error message', () => {
    expect(() => Email.create('secret-looking\nvalue')).toThrow(/^Invalid email address$/);
  });

  it('accepts plus-addressing in the local part', () => {
    expect(() => Email.create('user+tag@example.com')).not.toThrow();
  });

  describe('one mailbox, one canonical value', () => {
    const canonical = 'x@xn--bcher-kva.de';

    it.each([
      ['NFC', 'x@bücher.de'],
      ['NFD (decomposed)', 'x@bücher.de'],
      ['punycode', 'x@xn--bcher-kva.de'],
      ['upper case', 'X@BÜCHER.DE'],
    ])('maps the %s spelling of a domain to the same value', (_label, raw) => {
      expect(Email.create(raw).value).toBe(canonical);
    });

    it('folds fullwidth letters and the Kelvin sign (NFKC)', () => {
      expect(Email.create('ｘ@example.com').value).toBe('x@example.com');
      expect(Email.create('K@example.com').value).toBe('k@example.com');
    });

    it('considers two spellings of the same address equal', () => {
      expect(Email.create('user@example.com').equals(Email.create('USER@EXAMPLE.COM'))).toBe(true);
    });
  });

  describe('look-alike and invisible characters', () => {
    it.each([
      ['zero-width space', 'us​er@example.com'],
      ['zero-width joiner', 'us‌er@example.com'],
      ['right-to-left override', 'us‮er@example.com'],
      ['no-break space', 'us er@example.com'],
      ['line separator', 'us er@example.com'],
      ['null byte', 'us\u0000er@example.com'],
      ['line feed', 'us\ner@example.com'],
      ['cyrillic letter in the local part', 'аdmin@example.com'],
      ['accented letter in the local part', 'josé@example.com'],
      ['quoted local part', '"john doe"@example.com'],
      ['quoted local part without space', '"x"@example.com'],
      ['dotted capital I (lowercases to two code points)', 'İ@example.com'],
    ])('rejects a %s', (_label, raw) => {
      expect(() => Email.create(raw)).toThrow(DomainValidationError);
    });
  });

  it('exposes the normalized value via toString', () => {
    expect(Email.create('User@Example.com').toString()).toBe('user@example.com');
  });

  describe('restore', () => {
    it('keeps a stored value as-is, without validating or normalizing it', () => {
      expect(Email.restore('Legacy@localhost').value).toBe('Legacy@localhost');
    });
  });
});
