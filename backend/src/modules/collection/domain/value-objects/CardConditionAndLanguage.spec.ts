import { CARD_CONDITIONS, parseCardCondition } from './CardCondition';
import { CARD_LANGUAGES, parseCardLanguage } from './CardLanguage';
import { DomainValidationError } from '../errors/DomainValidationError';

describe('parseCardCondition', () => {
  it.each(CARD_CONDITIONS)('returns %s unchanged', (condition) => {
    expect(parseCardCondition(condition)).toBe(condition);
  });

  it('rejects anything else, listing the accepted values without echoing the input', () => {
    expect(() => parseCardCondition('secret-input')).toThrow(DomainValidationError);
    expect(() => parseCardCondition('secret-input')).toThrow('NM, LP, MP, HP, DMG');
    expect(() => parseCardCondition('secret-input')).not.toThrow(/secret-input/);
  });
});

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
