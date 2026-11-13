import { readAccountIdentifier } from './RequestAccount';

describe('readAccountIdentifier', () => {
  it('returns the canonical email, so every spelling of a mailbox is one account', () => {
    expect(readAccountIdentifier({ email: '  Ash@Example.COM ' })).toBe('ash@example.com');
    expect(readAccountIdentifier({ email: 'ash@EXAMPLE.com' })).toBe('ash@example.com');
  });

  it('falls back to a trimmed, lowercased, truncated copy for something that is not an address', () => {
    expect(readAccountIdentifier({ email: ' Not An Email ' })).toBe('not an email');
    expect(readAccountIdentifier({ email: 'x'.repeat(900_000) })).toHaveLength(254);
  });

  it.each([undefined, null, 'x', 12, {}, { email: 12 }, { email: '' }, { email: '   ' }])(
    'returns null when the body names no account (%j)',
    (body) => {
      expect(readAccountIdentifier(body)).toBeNull();
    },
  );
});
