import { domainToASCII } from 'node:url';
import isEmail from 'validator/lib/isEmail';
import { DomainValidationError } from '../errors/DomainValidationError';

// RFC 5321 §4.5.3.1.3 — checked on the normalized (punycode) form.
const EMAIL_MAX_LENGTH = 254;

// Control, format (zero-width, bidi overrides), line/paragraph separators and
// any space: invisible or look-alike characters have no place in an address.
const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Zs}]/u;

export class Email {
  private constructor(public readonly value: string) {}

  /**
   * Canonical form: NFKC, trimmed, lowercase, domain in punycode. Two spellings
   * of the same mailbox (NFC/NFD, IDN/punycode, fullwidth letters, Kelvin sign)
   * must give the same value, otherwise the unique index lets one mailbox
   * register several accounts. The grammar itself is delegated to validator.js
   * rather than a hand-rolled regex; quoted and non-ASCII local parts are
   * refused because they are the main source of look-alike addresses.
   */
  static create(raw: string): Email {
    const canonical = Email.canonicalize(raw);

    if (
      canonical === null ||
      canonical.length > EMAIL_MAX_LENGTH ||
      canonical.includes('"') ||
      !isEmail(canonical, { allow_utf8_local_part: false })
    ) {
      throw new DomainValidationError('Invalid email address');
    }

    return new Email(canonical);
  }

  /**
   * Rebuilds an Email from a value already persisted. Deliberately not
   * re-validated nor re-normalized: stored data was accepted under the rules
   * of its time, and a rule tightened later must not make existing accounts
   * impossible to load.
   */
  static restore(stored: string): Email {
    return new Email(stored);
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  private static canonicalize(raw: string): string | null {
    const trimmed = raw.normalize('NFKC').trim().toLowerCase();
    if (trimmed.length === 0 || FORBIDDEN_CHARACTERS.test(trimmed)) {
      return null;
    }

    const separator = trimmed.lastIndexOf('@');
    if (separator === -1) {
      return trimmed;
    }

    const asciiDomain = domainToASCII(trimmed.slice(separator + 1));
    if (asciiDomain === '') {
      return null;
    }

    return `${trimmed.slice(0, separator)}@${asciiDomain}`;
  }
}
