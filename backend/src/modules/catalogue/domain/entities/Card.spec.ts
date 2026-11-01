import { LocalizedText } from '../value-objects/LocalizedText';
import { LocalizedUrl } from '../value-objects/LocalizedUrl';
import { Card, type CardProps } from './Card';
import { CardSet } from './CardSet';
import { CardVariant } from './CardVariant';
import { LicenceTCG } from './LicenceTCG';

const SET = CardSet.restore({
  id: '1de9327c-6851-4e26-b347-322d465e34f7',
  licenceTCG: LicenceTCG.restore({
    id: '5b0c6c32-86b8-4a53-8f0e-6f8a8bd9d111',
    slug: 'pokemon',
    name: 'Pokémon',
    logoUrl: null,
  }),
  tcgdexId: 'swsh3',
  name: LocalizedText.of('Darkness Ablaze', 'Ténèbres Embrasées'),
  serie: null,
  releaseDate: null,
  abbreviationOfficial: 'DAA',
  abbreviationFr: 'TEM',
  tcgOnlineCode: null,
  officialCardCount: 189,
  totalCardCount: 201,
  printingCounts: { normal: null, reverse: null, holo: null, firstEdition: null },
  logo: LocalizedUrl.of(null, null),
  symbolUrl: null,
});

function buildVariant(tcgdexVariantId: string): CardVariant {
  return CardVariant.restore({
    id: `id-${tcgdexVariantId}`,
    tcgdexVariantId,
    type: 'holo',
    subtype: null,
    size: 'standard',
    stamps: [],
    foil: null,
    cardmarketProductId: null,
    tcgplayerProductId: null,
    cardtraderProductId: null,
  });
}

function buildCard(overrides: Partial<CardProps> = {}): Card {
  return Card.restore({
    id: 'c36fbf34-c84d-4464-a0a4-aa1839ad1add',
    set: SET,
    tcgdexId: 'swsh3-20',
    number: '20',
    name: LocalizedText.of('Charizard VMAX', 'Dracaufeu VMAX'),
    category: 'Pokemon',
    rarity: 'Holo Rare VMAX',
    illustrator: 'aky CG Works',
    hp: 330,
    types: ['Fire'],
    dexIds: [6],
    evolveFrom: LocalizedText.of('Charizard V', 'Dracaufeu-V'),
    stage: 'VMAX',
    tcgdexUpdatedAt: new Date('2026-07-01T20:27:44.000Z'),
    image: LocalizedUrl.of(
      'https://assets.tcgdex.net/en/swsh/swsh3/20',
      'https://assets.tcgdex.net/fr/swsh/swsh3/20',
    ),
    variants: [buildVariant('jr7oetx1mqug9')],
    ...overrides,
  });
}

describe('Card', () => {
  it('restores a card with its set and its printings', () => {
    const card = buildCard();

    expect(card.set.tcgdexId).toBe('swsh3');
    expect(card.set.licenceTCG.slug).toBe('pokemon');
    expect(card.variants).toHaveLength(1);
    expect(card).toMatchObject({ hp: 330, types: ['Fire'], dexIds: [6], stage: 'VMAX' });
  });

  describe('nameIn', () => {
    it('gives the name in the requested language', () => {
      const card = buildCard();

      expect(card.nameIn('en')).toBe('Charizard VMAX');
      expect(card.nameIn('fr')).toBe('Dracaufeu VMAX');
    });

    it('falls back on English for a card TCGdex does not translate', () => {
      const card = buildCard({ name: LocalizedText.of('Charizard VMAX', null) });

      expect(card.nameIn('fr')).toBe('Charizard VMAX');
    });
  });

  describe('imageBaseUrlIn', () => {
    it('gives the image of the requested language', () => {
      expect(buildCard().imageBaseUrlIn('fr')).toBe('https://assets.tcgdex.net/fr/swsh/swsh3/20');
    });

    it('falls back on the other language, then on null', () => {
      const onlyEnglish = buildCard({
        image: LocalizedUrl.of('https://assets.tcgdex.net/en/swsh/swsh3/20', null),
      });

      expect(onlyEnglish.imageBaseUrlIn('fr')).toBe('https://assets.tcgdex.net/en/swsh/swsh3/20');
      expect(buildCard({ image: LocalizedUrl.of(null, null) }).imageBaseUrlIn('en')).toBeNull();
    });
  });

  describe('findVariant', () => {
    it('finds a printing by its TCGdex variant id', () => {
      const card = buildCard({ variants: [buildVariant('a'), buildVariant('b')] });

      expect(card.findVariant('b')?.tcgdexVariantId).toBe('b');
    });

    it('gives null for a printing the card does not have', () => {
      expect(buildCard().findVariant('unknown')).toBeNull();
    });
  });

  describe('compareByNumber', () => {
    it('orders the numbers the way they are printed, not alphabetically', () => {
      const numbers = ['10', '2', 'TG01', '006', '100', '1'];
      const sorted = numbers
        .map((number) => buildCard({ number }))
        .sort((a, b) => Card.compareByNumber(a, b))
        .map((card) => card.number);

      expect(sorted).toEqual(['1', '2', '006', '10', '100', 'TG01']);
    });

    it('treats two cards with the same number as equal', () => {
      expect(Card.compareByNumber(buildCard(), buildCard())).toBe(0);
    });
  });
});
