import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { CardNameSearch } from '../../domain/value-objects/CardNameSearch';
import { CARD_INCLUDE, type CardRecord } from './CardMapper';
import { PrismaCardRepository } from './PrismaCardRepository';

const CARD_ID = 'c36fbf34-c84d-4464-a0a4-aa1839ad1add';
const SET_ID = '1de9327c-6851-4e26-b347-322d465e34f7';
const NOW = new Date('2026-10-25T10:00:00.000Z');

function buildRecord(overrides: Partial<CardRecord> = {}): CardRecord {
  return {
    id: CARD_ID,
    setId: SET_ID,
    tcgdexId: 'swsh3-20',
    number: '20',
    nameEn: 'Charizard VMAX',
    nameFr: 'Dracaufeu VMAX',
    category: 'Pokemon',
    rarity: 'Holo Rare VMAX',
    illustrator: 'aky CG Works',
    hp: 330,
    types: ['Fire'],
    dexIds: [6],
    evolveFromEn: 'Charizard V',
    evolveFromFr: 'Dracaufeu-V',
    stage: 'VMAX',
    tcgdexUpdatedAt: new Date('2026-07-01T20:27:44.000Z'),
    imageUrlEn: 'https://assets.tcgdex.net/en/swsh/swsh3/20',
    imageUrlFr: 'https://assets.tcgdex.net/fr/swsh/swsh3/20',
    createdAt: NOW,
    updatedAt: NOW,
    set: {
      id: SET_ID,
      licenceTCGId: '5b0c6c32-86b8-4a53-8f0e-6f8a8bd9d111',
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
      logoUrlEn: 'https://assets.tcgdex.net/en/swsh/swsh3/logo',
      logoUrlFr: 'https://assets.tcgdex.net/fr/swsh/swsh3/logo',
      symbolUrl: null,
      createdAt: NOW,
      updatedAt: NOW,
      licenceTCG: {
        id: '5b0c6c32-86b8-4a53-8f0e-6f8a8bd9d111',
        slug: 'pokemon',
        name: 'Pokémon',
        logoUrl: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    },
    variants: [
      {
        id: '9a1f1e8e-2d1a-4d0c-9d0b-0f7e5b7a6c10',
        cardId: CARD_ID,
        tcgdexVariantId: 'jr7oetx1mqug9',
        type: 'holo',
        subtype: null,
        size: 'standard',
        stamps: [],
        foil: null,
        cardmarketProductId: 482974,
        tcgplayerProductId: 219233,
        cardtraderProductId: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    ...overrides,
  };
}

function buildRepository(overrides: { findUnique?: jest.Mock; findMany?: jest.Mock } = {}) {
  const findUnique = overrides.findUnique ?? jest.fn().mockResolvedValue(null);
  const findMany = overrides.findMany ?? jest.fn().mockResolvedValue([]);
  const repository = new PrismaCardRepository({
    card: { findUnique, findMany },
  } as unknown as PrismaClient);

  return { repository, findUnique, findMany };
}

describe('PrismaCardRepository', () => {
  describe('findById', () => {
    it('loads the card with its set, its licence and its printings', async () => {
      const { repository, findUnique } = buildRepository({
        findUnique: jest.fn().mockResolvedValue(buildRecord()),
      });

      const card = await repository.findById(CARD_ID);

      expect(findUnique).toHaveBeenCalledWith({ where: { id: CARD_ID }, include: CARD_INCLUDE });
      expect(card).toMatchObject({
        id: CARD_ID,
        tcgdexId: 'swsh3-20',
        number: '20',
        category: 'Pokemon',
        rarity: 'Holo Rare VMAX',
        illustrator: 'aky CG Works',
        hp: 330,
        types: ['Fire'],
        dexIds: [6],
        stage: 'VMAX',
        tcgdexUpdatedAt: new Date('2026-07-01T20:27:44.000Z'),
      });
    });

    it('maps the English and French texts and images', async () => {
      const { repository } = buildRepository({
        findUnique: jest.fn().mockResolvedValue(buildRecord()),
      });

      const card = await repository.findById(CARD_ID);

      expect(card?.nameIn('en')).toBe('Charizard VMAX');
      expect(card?.nameIn('fr')).toBe('Dracaufeu VMAX');
      expect(card?.evolveFrom?.in('fr')).toBe('Dracaufeu-V');
      expect(card?.imageBaseUrlIn('fr')).toBe('https://assets.tcgdex.net/fr/swsh/swsh3/20');
    });

    it('maps the set, its series, its counts and its licence', async () => {
      const { repository } = buildRepository({
        findUnique: jest.fn().mockResolvedValue(buildRecord()),
      });

      const set = (await repository.findById(CARD_ID))?.set;

      expect(set).toMatchObject({
        tcgdexId: 'swsh3',
        officialCardCount: 189,
        totalCardCount: 201,
        printingCounts: { normal: 138, reverse: 157, holo: 69, firstEdition: 0 },
        tcgOnlineCode: 'DAA',
      });
      expect(set?.name.in('fr')).toBe('Ténèbres Embrasées');
      expect(set?.serie).toMatchObject({ tcgdexId: 'swsh' });
      expect(set?.serie?.name.in('fr')).toBe('Épée et Bouclier');
      expect(set?.abbreviationIn('fr')).toBe('TEM');
      expect(set?.logo.in('en')).toBe('https://assets.tcgdex.net/en/swsh/swsh3/logo');
      expect(set?.licenceTCG).toMatchObject({ slug: 'pokemon', name: 'Pokémon', logoUrl: null });
    });

    it('maps the printings with their product ids', async () => {
      const { repository } = buildRepository({
        findUnique: jest.fn().mockResolvedValue(buildRecord()),
      });

      const card = await repository.findById(CARD_ID);

      expect(card?.variants).toHaveLength(1);
      expect(card?.findVariant('jr7oetx1mqug9')).toMatchObject({
        type: 'holo',
        size: 'standard',
        cardmarketProductId: 482974,
        tcgplayerProductId: 219233,
        cardtraderProductId: null,
      });
    });

    it('keeps what TCGdex does not give as null: no series, no evolution, no French', async () => {
      const bare = buildRecord({
        nameFr: null,
        evolveFromEn: null,
        evolveFromFr: null,
        imageUrlFr: null,
        rarity: null,
        hp: null,
        set: {
          ...buildRecord().set,
          serieTcgdexId: null,
          serieNameEn: null,
          serieNameFr: null,
        },
      });
      const { repository } = buildRepository({ findUnique: jest.fn().mockResolvedValue(bare) });

      const card = await repository.findById(CARD_ID);

      expect(card?.nameIn('fr')).toBe('Charizard VMAX');
      expect(card?.evolveFrom).toBeNull();
      expect(card?.imageBaseUrlIn('fr')).toBe('https://assets.tcgdex.net/en/swsh/swsh3/20');
      expect(card?.set.serie).toBeNull();
      expect(card).toMatchObject({ rarity: null, hp: null });
    });

    it('gives null when the card does not exist', async () => {
      const { repository } = buildRepository();

      await expect(repository.findById(CARD_ID)).resolves.toBeNull();
    });

    it('gives null without asking the database when the id is not a UUID', async () => {
      const { repository, findUnique } = buildRepository();

      await expect(repository.findById('not-a-uuid')).resolves.toBeNull();
      await expect(repository.findById('')).resolves.toBeNull();
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('propagates database errors', async () => {
      const { repository } = buildRepository({
        findUnique: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });

      await expect(repository.findById(CARD_ID)).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('findBySetId', () => {
    it('loads the cards of the set with their relations', async () => {
      const { repository, findMany } = buildRepository({
        findMany: jest.fn().mockResolvedValue([buildRecord()]),
      });

      const cards = await repository.findBySetId(SET_ID);

      expect(findMany).toHaveBeenCalledWith({ where: { setId: SET_ID }, include: CARD_INCLUDE });
      expect(cards).toHaveLength(1);
      expect(cards[0].set.tcgdexId).toBe('swsh3');
    });

    it('returns the cards in printed order, not in alphabetical order', async () => {
      const { repository } = buildRepository({
        findMany: jest
          .fn()
          .mockResolvedValue([
            buildRecord({ number: '10', tcgdexId: 'swsh3-10' }),
            buildRecord({ number: '2', tcgdexId: 'swsh3-2' }),
            buildRecord({ number: '100', tcgdexId: 'swsh3-100' }),
            buildRecord({ number: '1', tcgdexId: 'swsh3-1' }),
          ]),
      });

      const cards = await repository.findBySetId(SET_ID);

      expect(cards.map((card) => card.number)).toEqual(['1', '2', '10', '100']);
    });

    it('gives an empty list for a set without cards', async () => {
      const { repository } = buildRepository();

      await expect(repository.findBySetId(SET_ID)).resolves.toEqual([]);
    });

    it('gives an empty list without asking the database when the id is not a UUID', async () => {
      const { repository, findMany } = buildRepository();

      await expect(repository.findBySetId('swsh3')).resolves.toEqual([]);
      expect(findMany).not.toHaveBeenCalled();
    });

    it('propagates database errors', async () => {
      const { repository } = buildRepository({
        findMany: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });

      await expect(repository.findBySetId(SET_ID)).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('searchByName', () => {
    it('looks for the term in the English and the French name, ignoring case', async () => {
      const { repository, findMany } = buildRepository();

      await repository.searchByName(CardNameSearch.create({ term: 'dracau', limit: 5 }));

      expect(findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { nameEn: { contains: 'dracau', mode: 'insensitive' } },
            { nameFr: { contains: 'dracau', mode: 'insensitive' } },
          ],
        },
        include: CARD_INCLUDE,
        orderBy: [{ nameEn: 'asc' }, { tcgdexId: 'asc' }],
        take: 5,
      });
    });

    it.each([
      ['a percent sign', '100%', '100\\%'],
      ['an underscore', 'Mr_Mime', 'Mr\\_Mime'],
      ['a backslash', 'a\\b', 'a\\\\b'],
      ['all of them', '%_\\', '\\%\\_\\\\'],
    ])('searches %s as plain text, not as a LIKE pattern', async (_label, term, escaped) => {
      const { repository, findMany } = buildRepository();

      await repository.searchByName(CardNameSearch.create({ term }));

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { nameEn: { contains: escaped, mode: 'insensitive' } },
              { nameFr: { contains: escaped, mode: 'insensitive' } },
            ],
          },
        }),
      );
    });
    it('uses the default limit when none is given', async () => {
      const { repository, findMany } = buildRepository();

      await repository.searchByName(CardNameSearch.create({ term: 'pika' }));

      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 20 }));
    });

    it('returns the cards found, in the order the database gave them', async () => {
      const { repository } = buildRepository({
        findMany: jest
          .fn()
          .mockResolvedValue([
            buildRecord({ nameEn: 'Charizard', tcgdexId: 'base1-4' }),
            buildRecord({ nameEn: 'Charizard V', tcgdexId: 'swsh3-19' }),
          ]),
      });

      const cards = await repository.searchByName(CardNameSearch.create({ term: 'chariz' }));

      expect(cards.map((card) => card.tcgdexId)).toEqual(['base1-4', 'swsh3-19']);
    });

    it('gives an empty list when nothing matches', async () => {
      const { repository } = buildRepository();

      await expect(
        repository.searchByName(CardNameSearch.create({ term: 'zzz' })),
      ).resolves.toEqual([]);
    });

    it('propagates database errors', async () => {
      const { repository } = buildRepository({
        findMany: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      });

      await expect(
        repository.searchByName(CardNameSearch.create({ term: 'pika' })),
      ).rejects.toThrow('ECONNREFUSED');
    });
  });
});
