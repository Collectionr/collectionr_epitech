import { LocalizedText } from './LocalizedText';

describe('LocalizedText', () => {
  const translated = LocalizedText.of('Charizard', 'Dracaufeu');
  const untranslated = LocalizedText.of('Charizard', null);

  it('gives the text in each language', () => {
    expect(translated.in('en')).toBe('Charizard');
    expect(translated.in('fr')).toBe('Dracaufeu');
  });

  it('falls back on English when there is no French translation', () => {
    expect(untranslated.in('fr')).toBe('Charizard');
  });

  it('tells whether a translation exists, English always being there', () => {
    expect(translated.isTranslatedIn('fr')).toBe(true);
    expect(untranslated.isTranslatedIn('fr')).toBe(false);
    expect(untranslated.isTranslatedIn('en')).toBe(true);
  });

  it('keeps both texts as they were stored', () => {
    expect(translated.en).toBe('Charizard');
    expect(untranslated.fr).toBeNull();
  });
});
