import { InvalidCardSearchError } from '../errors/InvalidCardSearchError';
import {
  CardNameSearch,
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_TERM_LENGTH,
  MIN_SEARCH_TERM_LENGTH,
} from './CardNameSearch';

describe('CardNameSearch', () => {
  it('keeps the term and uses the default limit', () => {
    const search = CardNameSearch.create({ term: 'Dracaufeu' });

    expect(search.term).toBe('Dracaufeu');
    expect(search.limit).toBe(DEFAULT_SEARCH_LIMIT);
  });

  it('trims the term', () => {
    expect(CardNameSearch.create({ term: '  Pikachu  ' }).term).toBe('Pikachu');
  });

  it('composes accents, so a decomposed e-acute searches the same as the composed one', () => {
    const decomposed = 'Pokemon'.replace('e', 'e\u0301');

    expect(CardNameSearch.create({ term: decomposed }).term).toBe('Pok\u00e9mon');
  });

  it('accepts the smallest and the longest term', () => {
    expect(() => CardNameSearch.create({ term: 'ex' })).not.toThrow();
    expect(() => CardNameSearch.create({ term: 'a'.repeat(MAX_SEARCH_TERM_LENGTH) })).not.toThrow();
  });

  it('accepts a custom limit up to the maximum', () => {
    expect(CardNameSearch.create({ term: 'ex', limit: 1 }).limit).toBe(1);
    expect(CardNameSearch.create({ term: 'ex', limit: MAX_SEARCH_LIMIT }).limit).toBe(
      MAX_SEARCH_LIMIT,
    );
  });

  it.each([
    ['a term that is too short', 'a'.repeat(MIN_SEARCH_TERM_LENGTH - 1)],
    ['a term made of spaces', '    '],
    ['an empty term', ''],
    ['a term that is too long', 'a'.repeat(MAX_SEARCH_TERM_LENGTH + 1)],
    ['a term with a control character', 'Pika\u0000chu'],
    ['a term with a zero-width character', 'Pika\u200bchu'],
    ['a term with a line separator', 'Pika\u2028chu'],
  ])('rejects %s', (_label, term) => {
    expect(() => CardNameSearch.create({ term })).toThrow(InvalidCardSearchError);
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['above the maximum', MAX_SEARCH_LIMIT + 1],
    ['not a whole number', 1.5],
    ['not a number', Number.NaN],
  ])('rejects a limit that is %s', (_label, limit) => {
    expect(() => CardNameSearch.create({ term: 'ex', limit })).toThrow(InvalidCardSearchError);
  });

  it('never echoes the rejected term in the error message', () => {
    expect.assertions(2);
    try {
      CardNameSearch.create({ term: 'x' });
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidCardSearchError);
      expect((error as Error).message).not.toContain('"x"');
    }
  });
});
