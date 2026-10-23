import { Email } from '../domain/value-objects/Email';

/** Longest address that can exist (RFC 5321); also bounds what an attacker can make us key or log. */
const MAX_ACCOUNT_LENGTH = 254;

/**
 * The account a request is about, read from the raw (not yet validated) body, in canonical form so
 * that every spelling of one mailbox counts against one bucket. Falls back to a trimmed, lowercased,
 * truncated copy for input that is not a valid address — a malformed login is still an attempt.
 * Returns null when the body names no account.
 */
export function readAccountIdentifier(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const raw = (body as { email?: unknown }).email;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return null;
  }

  // This runs in a guard, before any DTO validation: never normalise more than could be an address.
  const bounded = raw.slice(0, MAX_ACCOUNT_LENGTH * 2);
  try {
    return Email.create(bounded).value;
  } catch {
    return bounded.trim().toLowerCase().slice(0, MAX_ACCOUNT_LENGTH);
  }
}
