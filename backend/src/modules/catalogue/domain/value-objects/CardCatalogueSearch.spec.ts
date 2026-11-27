import { InvalidCardSearchError } from '../errors/InvalidCardSearchError';
import { CardCatalogueSearch } from './CardCatalogueSearch';

describe('CardCatalogueSearch', () => {
  it('accepts a general query and the default limit', () => {
    const search = CardCatalogueSearch.create({ query: 'chariz' });

    expect(search.query).toBe('chariz');
    expect(search.limit).toBe(20);
    expect(search.language).toBe('en');
  });

  it('accepts independent name, set and number filters', () => {
    const search = CardCatalogueSearch.create({
      name: 'Charizard',
      set: 'Darkness',
      number: '006',
      language: 'fr',
      limit: 10,
    });

    expect(search.name).toBe('Charizard');
    expect(search.set).toBe('Darkness');
    expect(search.number).toBe('006');
    expect(search.language).toBe('fr');
    expect(search.limit).toBe(10);
  });

  it('accepts a one-character printed card number', () => {
    expect(CardCatalogueSearch.create({ number: '6' }).number).toBe('6');
  });

  it('trims and normalizes accents', () => {
    const decomposed = 'Pokemon'.replace('e', 'e\u0301');
    const search = CardCatalogueSearch.create({ name: `  ${decomposed}  ` });

    expect(search.name).toBe('Pok\u00e9mon');
  });

  it('rejects an empty request', () => {
    expect(() => CardCatalogueSearch.create({ query: '   ' })).toThrow(InvalidCardSearchError);
  });

  it('rejects invalid terms and limits', () => {
    expect(() => CardCatalogueSearch.create({ query: 'a' })).toThrow(InvalidCardSearchError);
    expect(() => CardCatalogueSearch.create({ query: 'Pika\u0000chu' })).toThrow(
      InvalidCardSearchError,
    );
    expect(() => CardCatalogueSearch.create({ query: 'Pikachu', limit: 51 })).toThrow(
      InvalidCardSearchError,
    );
  });
});
