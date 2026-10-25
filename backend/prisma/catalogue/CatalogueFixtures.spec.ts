import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  REFERENCE_SET_IDS,
  loadReferenceCatalogue,
  mergeSetFixtures,
  parseTcgdexFixture,
  type CatalogueSetData,
  type TcgdexCard,
  type TcgdexFixture,
  type TcgdexSet,
} from './CatalogueFixtures';

const FIXTURES_DIRECTORY = join(__dirname, '..', 'fixtures', 'tcgdex');

function tcgdexSet(overrides: Partial<TcgdexSet> = {}): TcgdexSet {
  return {
    id: 'test1',
    name: 'Test Set',
    releaseDate: '2020-08-14',
    logo: 'https://assets.tcgdex.net/en/test/test1/logo',
    symbol: 'https://assets.tcgdex.net/univ/test/test1/symbol',
    serie: { id: 'test', name: 'Test Series' },
    abbreviationOfficial: 'TST',
    abbreviationLocalized: null,
    tcgOnline: 'TST',
    officialCardCount: 1,
    totalCardCount: 2,
    normalCardCount: 1,
    reverseCardCount: 1,
    holoCardCount: 0,
    firstEditionCardCount: 0,
    legal: { standard: false, expanded: true },
    ...overrides,
  };
}

function tcgdexCard(overrides: Partial<TcgdexCard> = {}): TcgdexCard {
  return {
    id: 'test1-1',
    localId: '1',
    name: 'Charizard',
    category: 'Pokemon',
    rarity: 'Rare',
    illustrator: 'Mitsuhiro Arita',
    hp: 120,
    types: ['Fire'],
    dexIds: [6],
    evolveFrom: 'Charmeleon',
    stage: 'Stage2',
    suffix: null,
    trainerType: null,
    energyType: null,
    regulationMark: 'D',
    legal: { standard: false, expanded: true },
    hasNormal: false,
    hasReverse: false,
    hasHolo: true,
    hasFirstEdition: false,
    hasWPromo: false,
    updated: '2026-07-01T21:27:44+01:00',
    image: 'https://assets.tcgdex.net/en/test/test1/1',
    variantsDetailed: [
      {
        variantId: 'abc123',
        type: 'holo',
        subtype: 'unlimited',
        size: 'standard',
        stamps: ['1st-edition'],
        foil: 'gold',
        cardmarketProductId: 10,
        tcgplayerProductId: 20,
        cardtraderProductId: 30,
      },
    ],
    ...overrides,
  };
}

function fixture(overrides: Partial<TcgdexFixture> = {}): TcgdexFixture {
  return { set: tcgdexSet(), cards: [tcgdexCard()], ...overrides };
}

function findSet(catalogue: CatalogueSetData[], tcgdexId: string): CatalogueSetData {
  const found = catalogue.find(({ set }) => set.tcgdexId === tcgdexId);
  if (!found) {
    throw new Error(`Set ${tcgdexId} not found in the reference catalogue`);
  }
  return found;
}

const validSet = { id: 'a', name: 'A', cardCount: { official: 1, total: 1 } };
const validCard = { id: 'a-1', localId: '1', name: 'X', category: 'Pokemon' };

describe('parseTcgdexFixture', () => {
  it('reads the fields the catalogue needs and defaults the optional ones', () => {
    const parsed = parseTcgdexFixture({
      set: validSet,
      cards: [{ ...validCard, category: 'Energy' }],
    });

    expect(parsed.set).toEqual({
      id: 'a',
      name: 'A',
      releaseDate: null,
      logo: null,
      symbol: null,
      serie: null,
      abbreviationOfficial: null,
      abbreviationLocalized: null,
      tcgOnline: null,
      officialCardCount: 1,
      totalCardCount: 1,
      normalCardCount: null,
      reverseCardCount: null,
      holoCardCount: null,
      firstEditionCardCount: null,
      legal: { standard: null, expanded: null },
    });
    expect(parsed.cards[0]).toEqual({
      id: 'a-1',
      localId: '1',
      name: 'X',
      category: 'Energy',
      rarity: null,
      illustrator: null,
      hp: null,
      types: [],
      dexIds: [],
      evolveFrom: null,
      stage: null,
      suffix: null,
      trainerType: null,
      energyType: null,
      regulationMark: null,
      legal: { standard: null, expanded: null },
      hasNormal: false,
      hasReverse: false,
      hasHolo: false,
      hasFirstEdition: false,
      hasWPromo: false,
      updated: null,
      image: null,
      variantsDetailed: [],
    });
  });

  it('reads the series, the abbreviations, the card counts and the legality of a set', () => {
    const parsed = parseTcgdexFixture({
      set: {
        ...validSet,
        serie: { id: 'swsh', name: 'Épée et Bouclier' },
        abbreviation: { official: 'DAA', localized: 'TEM' },
        tcgOnline: 'DAA',
        legal: { standard: false, expanded: true },
        cardCount: { official: 189, total: 201, normal: 138, reverse: 157, holo: 69, firstEd: 0 },
      },
      cards: [],
    });

    expect(parsed.set).toMatchObject({
      serie: { id: 'swsh', name: 'Épée et Bouclier' },
      abbreviationOfficial: 'DAA',
      abbreviationLocalized: 'TEM',
      tcgOnline: 'DAA',
      normalCardCount: 138,
      reverseCardCount: 157,
      holoCardCount: 69,
      firstEditionCardCount: 0,
      legal: { standard: false, expanded: true },
    });
  });

  it('reads the printings of a card, with their third-party product ids', () => {
    const parsed = parseTcgdexFixture({
      set: validSet,
      cards: [
        {
          ...validCard,
          variants: { normal: true, holo: true, reverse: false, firstEdition: false, wPromo: true },
          variants_detailed: [
            {
              variantId: 'v1',
              type: 'holo',
              subtype: 'shadowless',
              size: 'standard',
              stamp: ['1st-edition'],
              foil: 'gold',
              thirdParty: { cardmarket: 1, tcgplayer: 2, cardtrader: 3 },
            },
            { variantId: 'v2', type: 'normal', size: 'jumbo' },
          ],
        },
      ],
    });

    expect(parsed.cards[0]).toMatchObject({
      hasNormal: true,
      hasHolo: true,
      hasReverse: false,
      hasFirstEdition: false,
      hasWPromo: true,
    });
    expect(parsed.cards[0].variantsDetailed).toEqual([
      {
        variantId: 'v1',
        type: 'holo',
        subtype: 'shadowless',
        size: 'standard',
        stamps: ['1st-edition'],
        foil: 'gold',
        cardmarketProductId: 1,
        tcgplayerProductId: 2,
        cardtraderProductId: 3,
      },
      {
        variantId: 'v2',
        type: 'normal',
        subtype: null,
        size: 'jumbo',
        stamps: [],
        foil: null,
        cardmarketProductId: null,
        tcgplayerProductId: null,
        cardtraderProductId: null,
      },
    ]);
  });

  it.each([
    ['a fixture that is not an object', 'nope', 'fixture must be an object'],
    ['cards that are not an array', { set: {}, cards: 'x' }, 'fixture.cards must be an array'],
    [
      'a set without id',
      { set: { name: 'A', cardCount: { official: 1, total: 1 } }, cards: [] },
      'set.id must be a non-empty string',
    ],
    [
      'a set card count that is not an integer',
      { set: { ...validSet, cardCount: { official: '1', total: 1 } }, cards: [] },
      'set.cardCount.official must be an integer',
    ],
    [
      'a set serie without name',
      { set: { ...validSet, serie: { id: 'x' } }, cards: [] },
      'set.serie.name must be a non-empty string',
    ],
    [
      'a set legality that is not a boolean',
      { set: { ...validSet, legal: { standard: 'yes' } }, cards: [] },
      'set.legal.standard must be a boolean when present',
    ],
    [
      'an optional string of the wrong type',
      { set: { ...validSet, logo: 5 }, cards: [] },
      'set.logo must be a string when present',
    ],
    [
      'a card without localId',
      { set: validSet, cards: [{ id: 'a-1', name: 'X', category: 'Energy' }] },
      'cards[0].localId must be a non-empty string',
    ],
    [
      'a card hp that is not an integer',
      { set: validSet, cards: [{ ...validCard, hp: '120' }] },
      'cards[0].hp must be an integer',
    ],
    [
      'card types that are not strings',
      { set: validSet, cards: [{ ...validCard, types: [1] }] },
      'cards[0].types must be an array of strings when present',
    ],
    [
      'Pokédex numbers that are not integers',
      { set: validSet, cards: [{ ...validCard, dexId: ['6'] }] },
      'cards[0].dexId must be an array of integers when present',
    ],
    [
      'variant flags that are not an object',
      { set: validSet, cards: [{ ...validCard, variants: true }] },
      'cards[0].variants must be an object',
    ],
    [
      'variant flags that are not booleans',
      { set: validSet, cards: [{ ...validCard, variants: { holo: 1 } }] },
      'cards[0].variants.holo must be a boolean when present',
    ],
    [
      'detailed variants that are not an array',
      { set: validSet, cards: [{ ...validCard, variants_detailed: {} }] },
      'cards[0].variants_detailed must be an array when present',
    ],
    [
      'a detailed variant without variantId',
      {
        set: validSet,
        cards: [{ ...validCard, variants_detailed: [{ type: 'holo', size: 'standard' }] }],
      },
      'cards[0].variants_detailed[0].variantId must be a non-empty string',
    ],
    [
      'a third-party product id that is not an integer',
      {
        set: validSet,
        cards: [
          {
            ...validCard,
            variants_detailed: [
              { variantId: 'v', type: 'holo', size: 'standard', thirdParty: { cardmarket: 'x' } },
            ],
          },
        ],
      },
      'cards[0].variants_detailed[0].thirdParty.cardmarket must be an integer',
    ],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseTcgdexFixture(raw)).toThrow(message);
  });
});

describe('mergeSetFixtures', () => {
  it('joins the English and French responses of a set on the TCGdex id', () => {
    const english = fixture();
    const french = fixture({
      set: tcgdexSet({
        name: 'Ensemble de test',
        logo: null,
        serie: { id: 'test', name: 'Série de test' },
        abbreviationLocalized: 'TES',
      }),
    });

    const { set } = mergeSetFixtures(english, french);

    expect(set).toEqual({
      tcgdexId: 'test1',
      nameEn: 'Test Set',
      nameFr: 'Ensemble de test',
      serieTcgdexId: 'test',
      serieNameEn: 'Test Series',
      serieNameFr: 'Série de test',
      releaseDate: new Date('2020-08-14T00:00:00.000Z'),
      abbreviationOfficial: 'TST',
      abbreviationFr: 'TES',
      tcgOnlineCode: 'TST',
      officialCardCount: 1,
      totalCardCount: 2,
      normalCardCount: 1,
      reverseCardCount: 1,
      holoCardCount: 0,
      firstEditionCardCount: 0,
      legalStandard: false,
      legalExpanded: true,
      logoUrlEn: 'https://assets.tcgdex.net/en/test/test1/logo',
      logoUrlFr: null,
      symbolUrl: 'https://assets.tcgdex.net/univ/test/test1/symbol',
    });
  });

  it('joins the English and French responses of a card on the TCGdex id', () => {
    const english = fixture({
      cards: [
        tcgdexCard({
          suffix: 'V',
          trainerType: 'Item',
          energyType: 'Normal',
          hasHolo: true,
          hasWPromo: true,
        }),
      ],
    });
    const french = fixture({
      cards: [
        tcgdexCard({
          name: 'Dracaufeu',
          category: 'Pokémon',
          types: ['Feu'],
          evolveFrom: 'Reptincel',
          stage: 'Niveau 2',
          trainerType: 'Objet',
          energyType: 'De base',
          image: 'https://assets.tcgdex.net/fr/test/test1/1',
        }),
      ],
    });

    const { cards } = mergeSetFixtures(english, french);

    expect(cards).toEqual([
      {
        tcgdexId: 'test1-1',
        number: '1',
        nameEn: 'Charizard',
        nameFr: 'Dracaufeu',
        categoryEn: 'Pokemon',
        categoryFr: 'Pokémon',
        rarityEn: 'Rare',
        rarityFr: 'Rare',
        illustrator: 'Mitsuhiro Arita',
        hp: 120,
        typesEn: ['Fire'],
        typesFr: ['Feu'],
        dexIds: [6],
        evolveFromEn: 'Charmeleon',
        evolveFromFr: 'Reptincel',
        stageEn: 'Stage2',
        stageFr: 'Niveau 2',
        suffix: 'V',
        trainerTypeEn: 'Item',
        trainerTypeFr: 'Objet',
        energyTypeEn: 'Normal',
        energyTypeFr: 'De base',
        regulationMark: 'D',
        legalStandard: false,
        legalExpanded: true,
        hasNormal: false,
        hasReverse: false,
        hasHolo: true,
        hasFirstEdition: false,
        hasWPromo: true,
        tcgdexUpdatedAt: new Date('2026-07-01T20:27:44.000Z'),
        imageUrlEn: 'https://assets.tcgdex.net/en/test/test1/1',
        imageUrlFr: 'https://assets.tcgdex.net/fr/test/test1/1',
      },
    ]);
  });

  it('takes the printings from the English response, as codes, with the id of their card', () => {
    const { variants } = mergeSetFixtures(
      fixture(),
      fixture({
        cards: [
          tcgdexCard({
            variantsDetailed: [
              {
                variantId: 'abc123',
                type: 'Holo',
                subtype: 'illimité',
                size: 'Standard',
                stamps: ['1re édition'],
                foil: 'Or',
                cardmarketProductId: 10,
                tcgplayerProductId: 20,
                cardtraderProductId: 30,
              },
            ],
          }),
        ],
      }),
    );

    expect(variants).toEqual([
      {
        cardTcgdexId: 'test1-1',
        tcgdexVariantId: 'abc123',
        type: 'holo',
        subtype: 'unlimited',
        size: 'standard',
        stamps: ['1st-edition'],
        foil: 'gold',
        cardmarketProductId: 10,
        tcgplayerProductId: 20,
        cardtraderProductId: 30,
      },
    ]);
  });

  it('leaves the French columns empty for a card TCGdex does not translate', () => {
    const { cards } = mergeSetFixtures(fixture(), fixture({ cards: [] }));

    expect(cards[0]).toMatchObject({
      nameEn: 'Charizard',
      nameFr: null,
      categoryFr: null,
      rarityFr: null,
      typesFr: [],
      evolveFromFr: null,
      stageFr: null,
      trainerTypeFr: null,
      energyTypeFr: null,
      imageUrlFr: null,
    });
  });

  it('falls back on the French symbol and keeps a null release date', () => {
    const english = fixture({ set: tcgdexSet({ symbol: null, releaseDate: null }) });
    const french = fixture({
      set: tcgdexSet({ symbol: 'https://assets.tcgdex.net/univ/fr-symbol' }),
    });

    const { set } = mergeSetFixtures(english, french);

    expect(set.symbolUrl).toBe('https://assets.tcgdex.net/univ/fr-symbol');
    expect(set.releaseDate).toBeNull();
  });

  it('falls back on the French response for the series id and the official abbreviation', () => {
    const english = fixture({
      set: tcgdexSet({ serie: null, abbreviationOfficial: null }),
    });

    const { set } = mergeSetFixtures(english, fixture());

    expect(set).toMatchObject({
      serieTcgdexId: 'test',
      serieNameEn: null,
      serieNameFr: 'Test Series',
      abbreviationOfficial: 'TST',
    });
  });

  it('rejects responses of different sets', () => {
    const french = fixture({ set: tcgdexSet({ id: 'other' }) });

    expect(() => mergeSetFixtures(fixture(), french)).toThrow('Set id differs between languages');
  });

  it('rejects responses with different card counts', () => {
    const french = fixture({ set: tcgdexSet({ totalCardCount: 3 }) });

    expect(() => mergeSetFixtures(fixture(), french)).toThrow('Card counts differ');
  });

  it('rejects a French card the English response does not have', () => {
    const french = fixture({ cards: [tcgdexCard({ id: 'test1-99' })] });

    expect(() => mergeSetFixtures(fixture(), french)).toThrow(
      'Card test1-99 exists in French but not in English',
    );
  });

  it('rejects a release date that is not YYYY-MM-DD', () => {
    const english = fixture({ set: tcgdexSet({ releaseDate: '14/08/2020' }) });

    expect(() => mergeSetFixtures(english, fixture())).toThrow('must be a YYYY-MM-DD date');
  });

  it('rejects a card update date that is not a timestamp', () => {
    const english = fixture({ cards: [tcgdexCard({ updated: 'yesterday' })] });

    expect(() => mergeSetFixtures(english, fixture())).toThrow(
      'card test1-1 updated must be an ISO 8601 timestamp',
    );
  });

  it('keeps a missing card update date as null', () => {
    const english = fixture({ cards: [tcgdexCard({ updated: null })] });

    expect(mergeSetFixtures(english, fixture()).cards[0].tcgdexUpdatedAt).toBeNull();
  });
});

describe('reference catalogue (versioned TCGdex responses)', () => {
  const catalogue = loadReferenceCatalogue();
  const allCards = catalogue.flatMap(({ cards }) => cards);
  const allVariants = catalogue.flatMap(({ variants }) => variants);

  const find = (setId: string, tcgdexId: string) =>
    findSet(catalogue, setId).cards.find((card) => card.tcgdexId === tcgdexId);

  it('contains the three reference sets', () => {
    expect(catalogue.map(({ set }) => set.tcgdexId)).toEqual([...REFERENCE_SET_IDS]);
    expect(catalogue.map(({ set }) => set.nameEn)).toEqual(['Base Set', 'Darkness Ablaze', '151']);
    expect(catalogue.map(({ set }) => set.nameFr)).toEqual([
      'Set de Base',
      'Ténèbres Embrasées',
      '151',
    ]);
  });

  it('has as many cards per set as TCGdex announces', () => {
    for (const { set, cards } of catalogue) {
      expect(cards).toHaveLength(set.totalCardCount);
      expect(set.officialCardCount).toBeLessThanOrEqual(set.totalCardCount);
    }
  });

  it('maps every field of the Darkness Ablaze set', () => {
    expect(findSet(catalogue, 'swsh3').set).toEqual({
      tcgdexId: 'swsh3',
      nameEn: 'Darkness Ablaze',
      nameFr: 'Ténèbres Embrasées',
      serieTcgdexId: 'swsh',
      serieNameEn: 'Sword & Shield',
      serieNameFr: 'Épée et Bouclier',
      releaseDate: new Date('2020-08-14T00:00:00.000Z'),
      abbreviationOfficial: 'DAA',
      abbreviationFr: 'TEM',
      tcgOnlineCode: 'DAA',
      officialCardCount: 189,
      totalCardCount: 201,
      normalCardCount: 138,
      reverseCardCount: 157,
      holoCardCount: 69,
      firstEditionCardCount: 0,
      legalStandard: false,
      legalExpanded: true,
      logoUrlEn: 'https://assets.tcgdex.net/en/swsh/swsh3/logo',
      logoUrlFr: 'https://assets.tcgdex.net/fr/swsh/swsh3/logo',
      symbolUrl: 'https://assets.tcgdex.net/univ/swsh/swsh3/symbol',
    });
  });

  it('keeps what only some sets have: no TCG Online code on the recent set, no French logo on Base Set', () => {
    const { set: recent } = findSet(catalogue, 'sv03.5');
    const { set: base } = findSet(catalogue, 'base1');

    expect(recent).toMatchObject({
      tcgOnlineCode: null,
      abbreviationOfficial: 'MEW',
      abbreviationFr: '151',
    });
    expect(base).toMatchObject({
      abbreviationFr: 'BAS',
      firstEditionCardCount: 103,
      logoUrlFr: null,
      symbolUrl: null,
      legalStandard: false,
      legalExpanded: false,
    });
  });

  it('keeps TCGdex ids unique and prefixed by the id of their set', () => {
    const ids = allCards.map((card) => card.tcgdexId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { set, cards } of catalogue) {
      for (const card of cards) {
        expect(card.tcgdexId).toBe(`${set.tcgdexId}-${card.number}`);
      }
    }
  });

  it('carries both languages on every card', () => {
    for (const card of allCards) {
      expect(card.nameFr).not.toBeNull();
      expect(card.categoryFr).not.toBeNull();
      expect(card.rarityFr).not.toBeNull();
    }
  });

  it('maps the Charizard VMAX used as the example in the TCGdex documentation', () => {
    expect(find('swsh3', 'swsh3-20')).toEqual({
      tcgdexId: 'swsh3-20',
      number: '20',
      nameEn: 'Charizard VMAX',
      nameFr: 'Dracaufeu VMAX',
      categoryEn: 'Pokemon',
      categoryFr: 'Pokémon',
      rarityEn: 'Holo Rare VMAX',
      rarityFr: 'Holo Rare VMAX',
      illustrator: 'aky CG Works',
      hp: 330,
      typesEn: ['Fire'],
      typesFr: ['Feu'],
      dexIds: [6],
      evolveFromEn: 'Charizard V',
      evolveFromFr: 'Dracaufeu-V',
      stageEn: 'VMAX',
      stageFr: 'VMAX',
      suffix: null,
      trainerTypeEn: null,
      trainerTypeFr: null,
      energyTypeEn: null,
      energyTypeFr: null,
      regulationMark: 'D',
      legalStandard: false,
      legalExpanded: true,
      hasNormal: false,
      hasReverse: false,
      hasHolo: true,
      hasFirstEdition: false,
      hasWPromo: false,
      tcgdexUpdatedAt: new Date('2026-07-01T21:27:44+01:00'),
      imageUrlEn: 'https://assets.tcgdex.net/en/swsh/swsh3/20',
      imageUrlFr: 'https://assets.tcgdex.net/fr/swsh/swsh3/20',
    });
  });

  it('keeps leading zeros of the card number and the dot of the set id', () => {
    expect(find('sv03.5', 'sv03.5-006')).toMatchObject({
      number: '006',
      nameEn: 'Charizard ex',
      suffix: 'ex',
    });
  });

  it('translates rarities that TCGdex translates and keeps the others as they come', () => {
    const base = findSet(catalogue, 'base1').cards;
    expect(base.find(({ rarityEn }) => rarityEn === 'Common')?.rarityFr).toBe('Commune');
    expect(base.find(({ rarityEn }) => rarityEn === 'Uncommon')?.rarityFr).toBe('Peu Commune');
  });

  it('translates the evolution stage, the Trainer type and the Energy type', () => {
    expect(find('base1', 'base1-4')).toMatchObject({
      stageEn: 'Stage2',
      stageFr: 'Niveau 2',
      evolveFromEn: 'Charmeleon',
      evolveFromFr: 'Reptincel',
      regulationMark: null,
    });
    expect(find('base1', 'base1-102')).toMatchObject({
      categoryEn: 'Energy',
      energyTypeEn: 'Normal',
      energyTypeFr: 'De base',
    });
    const trainerTypes = allCards
      .filter(({ trainerTypeEn }) => trainerTypeEn !== null)
      .map(({ trainerTypeEn, trainerTypeFr }) => `${trainerTypeEn}/${trainerTypeFr}`);
    expect(new Set(trainerTypes)).toEqual(
      new Set(['Item/Objet', 'Supporter/Supporter', 'Stadium/Stade', 'Tool/Outil']),
    );
  });

  it('leaves hp and types empty on most Trainer and Energy cards, but keeps them when TCGdex has them', () => {
    expect(find('base1', 'base1-92')).toMatchObject({
      categoryEn: 'Trainer',
      hp: null,
      typesEn: [],
    });
    expect(find('base1', 'base1-102')).toMatchObject({
      categoryEn: 'Energy',
      hp: null,
      typesEn: [],
    });
    expect(find('base1', 'base1-70')).toMatchObject({ categoryEn: 'Trainer', hp: 10 });
    expect(find('sv03.5', 'sv03.5-207')).toMatchObject({
      categoryEn: 'Energy',
      typesEn: ['Psychic'],
      typesFr: ['Psy'],
    });
  });

  it('only references the TCGdex CDN, without extension: no image is stored locally', () => {
    for (const card of allCards) {
      for (const url of [card.imageUrlEn, card.imageUrlFr]) {
        expect(url).toMatch(/^https:\/\/assets\.tcgdex\.net\/(en|fr)\//);
        expect(url).not.toMatch(/\.(png|jpe?g|webp|avif)$/);
      }
    }
  });

  describe('printings', () => {
    it('gives every card at least one printing, attached to a card of the catalogue', () => {
      const cardIds = new Set(allCards.map(({ tcgdexId }) => tcgdexId));
      const withVariants = new Set(allVariants.map(({ cardTcgdexId }) => cardTcgdexId));

      expect(withVariants).toEqual(cardIds);
      expect(allVariants).toHaveLength(1163);
    });

    it('identifies a printing by its card and its TCGdex variantId together', () => {
      const keys = allVariants.map((v) => `${v.cardTcgdexId}/${v.tcgdexVariantId}`);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('shares a TCGdex variantId between cards: it is not a key on its own', () => {
      const cardsByVariantId = new Map<string, Set<string>>();
      for (const { tcgdexVariantId, cardTcgdexId } of allVariants) {
        cardsByVariantId.set(
          tcgdexVariantId,
          (cardsByVariantId.get(tcgdexVariantId) ?? new Set()).add(cardTcgdexId),
        );
      }

      const shared = [...cardsByVariantId.values()].filter((cards) => cards.size > 1);
      expect(shared.length).toBeGreaterThan(0);
    });

    it('maps the four printings of the Base Set Charizard', () => {
      const printings = allVariants.filter(({ cardTcgdexId }) => cardTcgdexId === 'base1-4');

      expect(printings.map(({ subtype, stamps }) => ({ subtype, stamps }))).toEqual([
        { subtype: 'unlimited', stamps: [] },
        { subtype: 'shadowless', stamps: ['1st-edition'] },
        { subtype: 'shadowless', stamps: [] },
        { subtype: '1999-2000-copyright', stamps: [] },
      ]);
      expect(printings[0]).toEqual({
        cardTcgdexId: 'base1-4',
        tcgdexVariantId: '4ffrmhcfiaejakhepqdkx7o',
        type: 'holo',
        subtype: 'unlimited',
        size: 'standard',
        stamps: [],
        foil: null,
        cardmarketProductId: 273699,
        tcgplayerProductId: 42382,
        cardtraderProductId: null,
      });
      expect(printings[3]).toMatchObject({ cardmarketProductId: null, tcgplayerProductId: null });
    });

    it('keeps the codes in English: the French labels are not stored', () => {
      for (const { type, size } of allVariants) {
        expect(type).toBe(type.toLowerCase());
        expect(['standard', 'jumbo']).toContain(size);
      }
      expect(new Set(allVariants.map(({ type }) => type))).toEqual(
        new Set(['normal', 'reverse', 'holo', 'metal']),
      );
    });

    it('keeps the kinds of printing a card has, as flags', () => {
      expect(find('swsh3', 'swsh3-20')).toMatchObject({ hasHolo: true, hasNormal: false });
      expect(find('base1', 'base1-92')).toMatchObject({ hasNormal: true, hasFirstEdition: true });
    });
  });
});

describe('fixture files', () => {
  const files = readdirSync(FIXTURES_DIRECTORY).filter((name) => name.endsWith('.json'));

  it('holds an English and a French response for each reference set, and nothing else', () => {
    const expected = REFERENCE_SET_IDS.flatMap((id) => [`${id}.en.json`, `${id}.fr.json`]);
    expect([...files].sort()).toEqual(expected.sort());
  });

  it.each(files)('%s carries no market price (not covered by the TCGdex MIT license)', (name) => {
    const content = readFileSync(join(FIXTURES_DIRECTORY, name), 'utf-8');
    expect(content).not.toContain('"pricing"');
  });
});
