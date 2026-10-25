import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { loadReferenceCatalogue } from './CatalogueFixtures';
import { POKEMON_LICENCE, seedCatalogue } from './SeedCatalogue';

interface UpsertArgs {
  where: Record<string, unknown>;
  update: Record<string, unknown>;
  create: Record<string, unknown>;
}

function createFakePrisma() {
  const licence = jest.fn((args: UpsertArgs) =>
    Promise.resolve({ id: 'licence-id', ...args.create }),
  );
  const cardSet = jest.fn((args: UpsertArgs) =>
    Promise.resolve({ id: `set-id-${String(args.where['tcgdexId'])}`, ...args.create }),
  );
  const card = jest.fn((args: UpsertArgs) =>
    Promise.resolve({ id: `card-id-${String(args.where['tcgdexId'])}`, ...args.create }),
  );
  const variant = jest.fn((args: UpsertArgs) => Promise.resolve(args.create));
  const transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));

  const prismaClient = {
    licenceTCG: { upsert: licence },
    cardSet: { upsert: cardSet },
    card: { upsert: card },
    variant: { upsert: variant },
    $transaction: transaction,
  } as unknown as PrismaClient;

  return { prismaClient, licence, cardSet, card, variant, transaction };
}

describe('seedCatalogue', () => {
  const catalogue = loadReferenceCatalogue();
  const cardTotal = catalogue.reduce((total, { cards }) => total + cards.length, 0);
  const variantTotal = catalogue.reduce((total, { variants }) => total + variants.length, 0);

  it('reports what it seeded', async () => {
    const { prismaClient } = createFakePrisma();

    await expect(seedCatalogue(prismaClient)).resolves.toEqual({
      sets: 3,
      cards: cardTotal,
      variants: variantTotal,
    });
  });

  it('upserts the licence on its slug', async () => {
    const { prismaClient, licence } = createFakePrisma();

    await seedCatalogue(prismaClient);

    expect(licence).toHaveBeenCalledTimes(1);
    expect(licence).toHaveBeenCalledWith({
      where: { slug: POKEMON_LICENCE.slug },
      update: { name: POKEMON_LICENCE.name },
      create: { slug: POKEMON_LICENCE.slug, name: POKEMON_LICENCE.name },
    });
  });

  it('upserts each set on its TCGdex id, attached to the licence', async () => {
    const { prismaClient, cardSet } = createFakePrisma();

    await seedCatalogue(prismaClient);

    expect(cardSet.mock.calls.map(([args]) => args.where)).toEqual([
      { tcgdexId: 'base1' },
      { tcgdexId: 'swsh3' },
      { tcgdexId: 'sv03.5' },
    ]);
    for (const [args] of cardSet.mock.calls) {
      expect(args.create['licenceTCGId']).toBe('licence-id');
      expect(args.update['licenceTCGId']).toBe('licence-id');
    }
  });

  it('upserts every card on its TCGdex id, attached to the stored set', async () => {
    const { prismaClient, card } = createFakePrisma();

    await seedCatalogue(prismaClient);

    expect(card).toHaveBeenCalledTimes(cardTotal);
    for (const [args] of card.mock.calls) {
      const tcgdexId = String(args.where['tcgdexId']);
      expect(args.create['tcgdexId']).toBe(tcgdexId);
      expect(args.update['tcgdexId']).toBe(tcgdexId);
      expect(args.create['setId']).toBe(`set-id-${tcgdexId.slice(0, tcgdexId.lastIndexOf('-'))}`);
    }
  });

  it('upserts every printing on its card and TCGdex variantId, attached to the stored card', async () => {
    const { prismaClient, variant } = createFakePrisma();

    await seedCatalogue(prismaClient);

    expect(variant).toHaveBeenCalledTimes(variantTotal);
    for (const [args] of variant.mock.calls) {
      const { cardId, tcgdexVariantId } = args.where['cardId_tcgdexVariantId'] as {
        cardId: string;
        tcgdexVariantId: string;
      };
      expect(cardId).toMatch(/^card-id-/);
      expect(args.create).toMatchObject({ cardId, tcgdexVariantId });
      expect(args.update).toMatchObject({ cardId, tcgdexVariantId });
      expect(args.create).not.toHaveProperty('cardTcgdexId');
    }
  });

  it('writes the cards of a set, then its printings, in two transactions per set', async () => {
    const { prismaClient, transaction } = createFakePrisma();

    await seedCatalogue(prismaClient);

    expect(transaction).toHaveBeenCalledTimes(6);
  });

  it('is idempotent: running it twice sends the very same upserts', async () => {
    const first = createFakePrisma();
    const second = createFakePrisma();

    await seedCatalogue(first.prismaClient);
    await seedCatalogue(second.prismaClient);

    expect(second.licence.mock.calls).toEqual(first.licence.mock.calls);
    expect(second.cardSet.mock.calls).toEqual(first.cardSet.mock.calls);
    expect(second.card.mock.calls).toEqual(first.card.mock.calls);
    expect(second.variant.mock.calls).toEqual(first.variant.mock.calls);
  });
});
