import { CARD_CONDITIONS, parseCardCondition } from './CardCondition';
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
