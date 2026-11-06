import { CARD_LANGUAGES, parseCardLanguage } from './CardLanguage';
import { DomainValidationError } from '../errors/DomainValidationError';

describe('parseCardLanguage', () => {
  it.each(CARD_LANGUAGES)('returns %s unchanged', (language) => {
    expect(parseCardLanguage(language)).toBe(language);
  });

  it('rejects anything else, listing the accepted values without echoing the input', () => {
    expect(() => parseCardLanguage('secret-input')).toThrow(DomainValidationError);
    expect(() => parseCardLanguage('secret-input')).toThrow('fr, en');
    expect(() => parseCardLanguage('secret-input')).not.toThrow(/secret-input/);
  });
});
