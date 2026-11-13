import { LocalizedUrl } from './LocalizedUrl';

const EN = 'https://assets.tcgdex.net/en/swsh/swsh3/20';
const FR = 'https://assets.tcgdex.net/fr/swsh/swsh3/20';

describe('LocalizedUrl', () => {
  it('gives the URL of the requested language', () => {
    const url = LocalizedUrl.of(EN, FR);

    expect(url.in('en')).toBe(EN);
    expect(url.in('fr')).toBe(FR);
  });

  it('falls back on the other language when the requested one has no asset', () => {
    expect(LocalizedUrl.of(EN, null).in('fr')).toBe(EN);
    expect(LocalizedUrl.of(null, FR).in('en')).toBe(FR);
  });

  it('gives null when there is no asset at all', () => {
    const none = LocalizedUrl.of(null, null);

    expect(none.in('en')).toBeNull();
    expect(none.in('fr')).toBeNull();
  });
});
