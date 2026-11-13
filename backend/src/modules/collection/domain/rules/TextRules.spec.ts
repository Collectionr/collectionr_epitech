import {
  characterCount,
  hasInvisibleCharacters,
  hasInvisibleCharactersInFreeText,
} from './TextRules';

describe('hasInvisibleCharacters', () => {
  it.each([
    ['null byte', 'a\u0000b'],
    ['zero-width space', 'a\u200Bb'],
    ['right-to-left override', 'a\u202Eb'],
    ['line feed', 'a\nb'],
    ['line separator', 'a\u2028b'],
    ['Hangul filler', 'a\u3164b'],
    ['halfwidth Hangul filler', 'a\uFFA0b'],
    ['blank braille pattern', 'a\u2800b'],
  ])('detects a %s', (_label, text) => {
    expect(hasInvisibleCharacters(text)).toBe(true);
  });

  it('lets letters, accents and regular spaces through', () => {
    expect(hasInvisibleCharacters('Écarlate et Violet')).toBe(false);
  });

  it.each([
    ['a plain emoji', '\u{1F525}'],
    ['a heart with its variation selector', '❤\uFE0F'],
    ['a lightning bolt with its variation selector', '⚡\uFE0F'],
    ['a keycap', '1\uFE0F⃣'],
    ['a family (zero width joiners)', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'],
    ['a heart on fire (selector then joiner)', '❤\uFE0F\u200D\u{1F525}'],
    ['a skin tone', '\u{1F44D}\u{1F3FD}'],
    ['a flag', '\u{1F1EB}\u{1F1F7}'],
    ['an emoji inside a name', 'Dracaufeu ⚡\uFE0F 1ère édition ❤\uFE0F'],
  ])('accepts %s', (_label, text) => {
    expect(hasInvisibleCharacters(text)).toBe(false);
  });

  it.each([
    ['a lone joiner', '\u200D'],
    ['a lone variation selector', '\uFE0F'],
    ['a joiner between letters', 'a\u200Db'],
    ['a variation selector after a letter', 'a\uFE0F'],
    ['a variation selector after a space', ' \uFE0F'],
  ])('still rejects %s', (_label, text) => {
    expect(hasInvisibleCharacters(text)).toBe(true);
  });
});

describe('hasInvisibleCharactersInFreeText', () => {
  it('allows line breaks and tabs but still rejects other invisible characters', () => {
    expect(hasInvisibleCharactersInFreeText('line 1\r\nline 2\tend')).toBe(false);
    expect(hasInvisibleCharactersInFreeText('a\u200Bb')).toBe(true);
    expect(hasInvisibleCharactersInFreeText('a\u0000b')).toBe(true);
  });

  it('allows emoji next to line breaks', () => {
    expect(hasInvisibleCharactersInFreeText('1ère édition ❤\uFE0F\nsignée')).toBe(false);
  });
});

describe('characterCount', () => {
  it('counts what a person sees, not UTF-16 units', () => {
    expect(characterCount('abc')).toBe(3);
    expect(characterCount('\u{1F600}'.repeat(31))).toBe(31);
  });

  it('counts the code points of a composed emoji', () => {
    expect(characterCount('❤\uFE0F')).toBe(2);
  });
});
