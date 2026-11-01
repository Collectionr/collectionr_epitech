import { LocalizedText } from '../value-objects/LocalizedText';
import { LocalizedUrl } from '../value-objects/LocalizedUrl';
import { CardSet, type CardSetProps } from './CardSet';
import { LicenceTCG } from './LicenceTCG';

function buildSet(overrides: Partial<CardSetProps> = {}): CardSet {
  return CardSet.restore({
    id: '1de9327c-6851-4e26-b347-322d465e34f7',
    licenceTCG: LicenceTCG.restore({
      id: '5b0c6c32-86b8-4a53-8f0e-6f8a8bd9d111',
      slug: 'pokemon',
      name: 'Pokémon',
      logoUrl: null,
    }),
    tcgdexId: 'swsh3',
    name: LocalizedText.of('Darkness Ablaze', 'Ténèbres Embrasées'),
    serie: { tcgdexId: 'swsh', name: LocalizedText.of('Sword & Shield', 'Épée et Bouclier') },
    releaseDate: new Date('2020-08-14T00:00:00.000Z'),
    abbreviationOfficial: 'DAA',
    abbreviationFr: 'TEM',
    tcgOnlineCode: 'DAA',
    officialCardCount: 189,
    totalCardCount: 201,
    printingCounts: { normal: 138, reverse: 157, holo: 69, firstEdition: 0 },
    logo: LocalizedUrl.of(
      'https://assets.tcgdex.net/en/swsh/swsh3/logo',
      'https://assets.tcgdex.net/fr/swsh/swsh3/logo',
    ),
    symbolUrl: null,
    ...overrides,
  });
}

describe('CardSet', () => {
  it('restores a set with its licence, names and counts', () => {
    const set = buildSet();

    expect(set.licenceTCG.slug).toBe('pokemon');
    expect(set.name.in('fr')).toBe('Ténèbres Embrasées');
    expect(set.serie?.name.in('en')).toBe('Sword & Shield');
    expect(set.officialCardCount).toBe(189);
    expect(set.totalCardCount).toBe(201);
    expect(set.printingCounts.reverse).toBe(157);
  });

  describe('abbreviationIn', () => {
    it('gives the French code in French and the official one in English', () => {
      const set = buildSet();

      expect(set.abbreviationIn('fr')).toBe('TEM');
      expect(set.abbreviationIn('en')).toBe('DAA');
    });

    it('falls back on the official code when there is no French one', () => {
      expect(buildSet({ abbreviationFr: null }).abbreviationIn('fr')).toBe('DAA');
    });

    it('gives null when the set has no code at all', () => {
      const set = buildSet({ abbreviationOfficial: null, abbreviationFr: null });

      expect(set.abbreviationIn('fr')).toBeNull();
      expect(set.abbreviationIn('en')).toBeNull();
    });
  });

  describe('completionOf', () => {
    it('counts the secret rares: 45 cards owned out of 201', () => {
      expect(buildSet().completionOf(45)).toBeCloseTo(45 / 201, 10);
    });

    it('is 0 when nothing is owned and 1 when the set is complete', () => {
      const set = buildSet();

      expect(set.completionOf(0)).toBe(0);
      expect(set.completionOf(201)).toBe(1);
    });

    it('never goes above 1 nor below 0', () => {
      const set = buildSet();

      expect(set.completionOf(500)).toBe(1);
      expect(set.completionOf(-3)).toBe(0);
    });

    it('is 0 for a set that has no card, instead of dividing by zero', () => {
      expect(buildSet({ totalCardCount: 0 }).completionOf(10)).toBe(0);
    });
  });
});
