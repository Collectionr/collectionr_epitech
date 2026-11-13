import { parseTrustedProxies } from './TrustedProxies';

describe('parseTrustedProxies', () => {
  it('trusts nobody when empty or blank', () => {
    expect(parseTrustedProxies('')).toEqual([]);
    expect(parseTrustedProxies('  ,  ')).toEqual([]);
  });

  it('returns the trimmed entries', () => {
    expect(parseTrustedProxies(' 10.0.0.0/8 , 192.168.1.10,::1 ')).toEqual([
      '10.0.0.0/8',
      '192.168.1.10',
      '::1',
    ]);
  });

  it.each(['*', 'true', 'all', 'not-an-ip', '10.0.0.0/33', '10.0.0.0/-1', '::/129', '1.2.3.4/x'])(
    'throws on %p',
    (value) => {
      expect(() => parseTrustedProxies(value)).toThrow(/TRUSTED_PROXIES/);
    },
  );
});
