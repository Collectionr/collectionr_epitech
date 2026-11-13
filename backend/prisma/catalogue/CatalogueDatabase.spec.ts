import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { Card } from '../../src/modules/catalogue/domain/entities/Card';
import { CardNameSearch } from '../../src/modules/catalogue/domain/value-objects/CardNameSearch';
import { PrismaCardRepository } from '../../src/modules/catalogue/infrastructure/repositories/PrismaCardRepository';
import { seedCatalogue } from './SeedCatalogue';

/**
 * The catalogue against a REAL PostgreSQL: what the other specs cannot prove with a doubled Prisma
 * (the migration, the upsert contract of the TCG microservice, the seed on a real database, the SQL
 * the repository generates). The backend CI has no PostgreSQL, so this suite is skipped unless
 * CATALOGUE_TEST_DATABASE_URL is set. It refuses a database whose name does not say it is
 * disposable, and one that holds anything but the seeded catalogue. To run it, on a throwaway
 * database (never a shared or personal one):
 *
 *   DATABASE_URL=<url> npm run prisma:migrate:deploy
 *   NODE_OPTIONS=--experimental-vm-modules CATALOGUE_TEST_DATABASE_URL=<url> npx jest prisma/catalogue/CatalogueDatabase
 *
 * The Node option is needed because the Prisma 7 client loads its query engine with a dynamic
 * import, which Jest only allows with it (PowerShell: set $env:NODE_OPTIONS first). The SQL below is
 * a simplified version of the templates in docs/database/schema-sql.md, not a copy of them.
 */
const DATABASE_URL = process.env['CATALOGUE_TEST_DATABASE_URL'];
const describeWithDatabase = DATABASE_URL ? describe : describe.skip;

const CONTRACT_PREFIX = 'zz-contract';
const CONTRACT_SET = `${CONTRACT_PREFIX}-set`;
const SEEDED_COUNTS = [1, 3, 510, 1163];
const SEED_TIMEOUT_MS = 120_000;
// "catalogue_check", "collectionr_test", "test-db": the word on its own, not "latest" or "contest".
const DISPOSABLE_NAME = /(^|[^a-z])(test|check)([^a-z]|$)/i;

function assertDisposableDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!DISPOSABLE_NAME.test(name)) {
    throw new Error(
      `CATALOGUE_TEST_DATABASE_URL must point at a disposable database whose name contains "test" or "check" as a word (got "${name}")`,
    );
  }
}

describeWithDatabase('catalogue in a real PostgreSQL (opt-in)', () => {
  let prismaClient: PrismaClient;
  let repository: PrismaCardRepository;

  const notContract = { NOT: { tcgdexId: { startsWith: CONTRACT_PREFIX } } };

  async function counts(): Promise<number[]> {
    return [
      await prismaClient.licenceTCG.count(),
      await prismaClient.cardSet.count({ where: notContract }),
      await prismaClient.card.count({ where: notContract }),
      await prismaClient.variant.count({ where: { card: notContract } }),
    ];
  }

  async function allIds(): Promise<string> {
    const [cards, variants] = await Promise.all([
      prismaClient.card.findMany({
        where: notContract,
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
      prismaClient.variant.findMany({
        where: { card: notContract },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    ]);
    return [...cards, ...variants].map((row) => row.id).join(',');
  }

  async function latestCardUpdate(): Promise<Date> {
    const rows = await prismaClient.$queryRaw<{ latest: Date }[]>`
      SELECT max("updatedAt") AS latest FROM cards WHERE "tcgdexId" NOT LIKE 'zz-contract%'`;
    return rows[0].latest;
  }

  // What the TCG microservice does: a raw UPSERT without id nor timestamps, French never erased.
  function rawUpsertCard(
    tcgdexId: string,
    nameEn: string,
    nameFr: string | null = null,
  ): Promise<number> {
    return prismaClient.$executeRaw`
      INSERT INTO cards ("setId", "tcgdexId", "number", "nameEn", "nameFr", "category")
      SELECT id, ${tcgdexId}, '1', ${nameEn}, ${nameFr}::text, 'Pokemon' FROM sets WHERE "tcgdexId" = ${CONTRACT_SET}
      ON CONFLICT ("tcgdexId") DO UPDATE SET
        "nameEn" = EXCLUDED."nameEn",
        "nameFr" = COALESCE(EXCLUDED."nameFr", cards."nameFr"),
        "updatedAt" = now()`;
  }

  function rawUpsertSet(tcgdexId: string, nameEn: string, nameFr: string | null): Promise<number> {
    return prismaClient.$executeRaw`
      INSERT INTO sets ("licenceTCGId", "tcgdexId", "nameEn", "nameFr", "officialCardCount", "totalCardCount")
      SELECT id, ${tcgdexId}, ${nameEn}, ${nameFr}::text, 1, 1 FROM licences_tcg WHERE slug = 'pokemon'
      ON CONFLICT ("tcgdexId") DO UPDATE SET
        "nameEn" = EXCLUDED."nameEn",
        "nameFr" = COALESCE(EXCLUDED."nameFr", sets."nameFr"),
        "updatedAt" = now()`;
  }

  function rawInsertVariant(
    cardTcgdexId: string,
    variantId: string,
    ignoreDuplicate = false,
  ): Promise<number> {
    return ignoreDuplicate
      ? prismaClient.$executeRaw`
          INSERT INTO variants ("cardId", "tcgdexVariantId", "type", "size")
          SELECT id, ${variantId}, 'holo', 'standard' FROM cards WHERE "tcgdexId" = ${cardTcgdexId}
          ON CONFLICT ("cardId", "tcgdexVariantId") DO NOTHING`
      : prismaClient.$executeRaw`
          INSERT INTO variants ("cardId", "tcgdexVariantId", "type", "size")
          SELECT id, ${variantId}, 'holo', 'standard' FROM cards WHERE "tcgdexId" = ${cardTcgdexId}`;
  }

  async function idOf(tcgdexId: string): Promise<string> {
    return (await prismaClient.card.findUniqueOrThrow({ where: { tcgdexId } })).id;
  }

  beforeAll(async () => {
    if (!DATABASE_URL) {
      throw new Error('CATALOGUE_TEST_DATABASE_URL is not set');
    }
    assertDisposableDatabase(DATABASE_URL);
    prismaClient = new PrismaClient({ adapter: new PrismaPg({ connectionString: DATABASE_URL }) });
    repository = new PrismaCardRepository(prismaClient);

    const existing = await counts().catch((error: unknown) => {
      const reason = error instanceof Error ? error.message.split('\n').pop() : String(error);
      throw new Error(
        `Cannot read the catalogue tables (${reason}): check the URL, and run prisma migrate deploy on this database first`,
      );
    });
    const isEmpty = existing.every((count) => count === 0);
    const isSeeded = existing.join() === SEEDED_COUNTS.join();
    if (!isEmpty && !isSeeded) {
      throw new Error(
        `This database already holds a catalogue that is not the seeded one (${existing.join('/')}): use an empty one`,
      );
    }

    await seedCatalogue(prismaClient);

    // A set of their own for the rows these tests write, so the reference sets are never touched.
    await prismaClient.$executeRaw`
      INSERT INTO sets ("licenceTCGId", "tcgdexId", "nameEn", "officialCardCount", "totalCardCount")
      SELECT id, ${CONTRACT_SET}, 'Contract set', 1, 1 FROM licences_tcg WHERE slug = 'pokemon'
      ON CONFLICT ("tcgdexId") DO NOTHING`;
    await rawUpsertCard(`${CONTRACT_PREFIX}-1`, 'First name');
    await rawUpsertCard(`${CONTRACT_PREFIX}-2`, 'Other card');
    await rawUpsertCard(`${CONTRACT_PREFIX}-pct`, 'Zz 100% Real');
    await rawUpsertCard(`${CONTRACT_PREFIX}-pcx`, 'Zz 100X Real');
    await rawUpsertCard(`${CONTRACT_PREFIX}-us`, 'Zz_Under');
    await rawUpsertCard(`${CONTRACT_PREFIX}-ux`, 'ZzXUnder');
    await rawUpsertCard(`${CONTRACT_PREFIX}-bs`, 'Zz back\\slash');
  }, SEED_TIMEOUT_MS);

  afterAll(async () => {
    if (!prismaClient) {
      return;
    }
    await prismaClient.$executeRaw`
      DELETE FROM variants WHERE "cardId" IN (SELECT id FROM cards WHERE "tcgdexId" LIKE 'zz-contract%')`;
    await prismaClient.$executeRaw`DELETE FROM cards WHERE "tcgdexId" LIKE 'zz-contract%'`;
    await prismaClient.$executeRaw`DELETE FROM sets WHERE "tcgdexId" LIKE 'zz-contract%'`;
    await prismaClient.$disconnect();
  });

  describe('seed', () => {
    it('inserts the licence, the three sets, their cards and their printings', async () => {
      await expect(counts()).resolves.toEqual(SEEDED_COUNTS);
    });

    it(
      'is idempotent: seeding again changes neither the counts, nor an id, nor a date',
      async () => {
        const idsBefore = await allIds();
        const updateBefore = await latestCardUpdate();

        await seedCatalogue(prismaClient);

        await expect(counts()).resolves.toEqual(SEEDED_COUNTS);
        expect(await allIds()).toBe(idsBefore);
        expect(await latestCardUpdate()).toEqual(updateBefore);
      },
      SEED_TIMEOUT_MS,
    );

    it(
      'never overwrites a row the microservice has refreshed',
      async () => {
        try {
          await prismaClient.$executeRaw`UPDATE cards SET "nameEn" = 'Refreshed by TCG' WHERE "tcgdexId" = 'swsh3-20'`;

          await seedCatalogue(prismaClient);

          const card = await prismaClient.card.findUniqueOrThrow({
            where: { tcgdexId: 'swsh3-20' },
          });
          expect(card.nameEn).toBe('Refreshed by TCG');
        } finally {
          await prismaClient.$executeRaw`UPDATE cards SET "nameEn" = 'Charizard VMAX' WHERE "tcgdexId" = 'swsh3-20'`;
        }
      },
      SEED_TIMEOUT_MS,
    );
  });

  describe('upsert contract of the TCG microservice', () => {
    it('inserts a card without id, timestamps nor lists, then updates it in place', async () => {
      await rawUpsertCard(`${CONTRACT_PREFIX}-upsert`, 'First name');
      await rawUpsertCard(`${CONTRACT_PREFIX}-upsert`, 'Second name');

      const rows = await prismaClient.card.findMany({
        where: { tcgdexId: `${CONTRACT_PREFIX}-upsert` },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ nameEn: 'Second name', types: [], dexIds: [] });
      expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('never erases a French name when a later call only has the English one', async () => {
      await rawUpsertCard(`${CONTRACT_PREFIX}-fr`, 'Zz Alpha', 'Zz Alpha fr');
      await rawUpsertCard(`${CONTRACT_PREFIX}-fr`, 'Zz Alpha renamed', null);

      const card = await prismaClient.card.findUniqueOrThrow({
        where: { tcgdexId: `${CONTRACT_PREFIX}-fr` },
      });
      expect(card).toMatchObject({ nameEn: 'Zz Alpha renamed', nameFr: 'Zz Alpha fr' });
    });

    it('does the same for a set', async () => {
      await rawUpsertSet(`${CONTRACT_PREFIX}-set-fr`, 'Set', 'Ensemble');
      await rawUpsertSet(`${CONTRACT_PREFIX}-set-fr`, 'Set renamed', null);

      const set = await prismaClient.cardSet.findUniqueOrThrow({
        where: { tcgdexId: `${CONTRACT_PREFIX}-set-fr` },
      });
      expect(set).toMatchObject({ nameEn: 'Set renamed', nameFr: 'Ensemble' });
    });

    it('refuses a NULL list: the application never has to guess what it means', async () => {
      await expect(
        prismaClient.$executeRaw`
          INSERT INTO cards ("setId", "tcgdexId", "number", "nameEn", "category", "types")
          SELECT id, ${CONTRACT_PREFIX + '-null'}, '1', 'X', 'Pokemon', NULL FROM sets WHERE "tcgdexId" = ${CONTRACT_SET}`,
      ).rejects.toThrow(/null value|not-null/i);
    });

    it('writes nothing, and says nothing, when the parent of an INSERT ... SELECT is missing', async () => {
      await expect(rawInsertVariant(`${CONTRACT_PREFIX}-no-such-card`, 'v')).resolves.toBe(0);
    });

    it('identifies a printing by its card and its variant id: shared between cards, unique inside one', async () => {
      await rawInsertVariant(`${CONTRACT_PREFIX}-1`, 'shared-variant', true);
      await rawInsertVariant(`${CONTRACT_PREFIX}-2`, 'shared-variant', true);

      await expect(rawInsertVariant(`${CONTRACT_PREFIX}-1`, 'shared-variant')).rejects.toThrow(
        /unique|duplicate/i,
      );
    });

    it('refuses to delete a licence, a set or a card that still has children', async () => {
      await expect(
        prismaClient.$executeRaw`DELETE FROM licences_tcg WHERE slug = 'pokemon'`,
      ).rejects.toThrow(/foreign key/i);
      await expect(
        prismaClient.$executeRaw`DELETE FROM sets WHERE "tcgdexId" = 'swsh3'`,
      ).rejects.toThrow(/foreign key/i);
      await expect(
        prismaClient.$executeRaw`DELETE FROM cards WHERE "tcgdexId" = 'base1-4'`,
      ).rejects.toThrow(/foreign key/i);
    });
  });

  describe('repository', () => {
    it('reads a whole set in printed order, with the numbers as text', async () => {
      const swsh3 = await prismaClient.cardSet.findUniqueOrThrow({ where: { tcgdexId: 'swsh3' } });
      const sv35 = await prismaClient.cardSet.findUniqueOrThrow({ where: { tcgdexId: 'sv03.5' } });

      const cards = await repository.findBySetId(swsh3.id);
      const recent = await repository.findBySetId(sv35.id);

      expect(cards).toHaveLength(201);
      expect(cards.slice(0, 10).map((card) => card.number)).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '8',
        '9',
        '10',
      ]);
      expect(
        cards.every((card, i) => i === 0 || Card.compareByNumber(cards[i - 1], card) <= 0),
      ).toBe(true);
      expect(recent[0].number).toBe('001');
      expect(recent[5].number).toBe('006');
    });

    it('reads a card with its set, its series, its licence and its printings', async () => {
      const card = await repository.findById(await idOf('base1-4'));

      expect(card?.nameIn('fr')).toBe('Dracaufeu');
      expect(card?.set.name.in('fr')).toBe('Set de Base');
      expect(card?.set.licenceTCG.slug).toBe('pokemon');
      expect(card?.variants).toHaveLength(4);
    });

    it('reads the printings of a card in a stable order: type, then TCGdex variant id', async () => {
      const card = await repository.findById(await idOf('base1-4'));

      expect(card?.variants.map((variant) => variant.tcgdexVariantId)).toEqual([
        '3takscxpcqoqcfnxk1ivs2y6',
        '4ffrmhcfiaejakhepqdkx7o',
        'mtltux8qtgdu4exu903oasum21juxbvx6lx',
        'zqq5g2u9n0st0gren5bssktmac2ywqaw',
      ]);
    });
    it('falls back on English for a card that has no French name', async () => {
      const card = await repository.findById(await idOf(`${CONTRACT_PREFIX}-1`));

      expect(card?.name.fr).toBeNull();
      expect(card?.nameIn('fr')).toBe('First name');
    });

    it('still reads a series and a previous evolution known in French only', async () => {
      await prismaClient.$executeRaw`
        UPDATE sets SET "serieTcgdexId" = 'zz', "serieNameFr" = 'Serie en francais' WHERE "tcgdexId" = ${CONTRACT_SET}`;
      await prismaClient.$executeRaw`
        UPDATE cards SET "evolveFromFr" = 'Reptincel' WHERE "tcgdexId" = ${CONTRACT_PREFIX + '-2'}`;

      const card = await repository.findById(await idOf(`${CONTRACT_PREFIX}-2`));

      expect(card?.set.serie?.name.in('en')).toBe('Serie en francais');
      expect(card?.evolveFrom?.in('fr')).toBe('Reptincel');
    });

    it('does not fail on an id that is not a UUID', async () => {
      await expect(repository.findById('not-a-uuid')).resolves.toBeNull();
      await expect(repository.findBySetId('swsh3')).resolves.toEqual([]);
    });

    it('finds cards by their French or English name, ignoring case', async () => {
      const french = await repository.searchByName(CardNameSearch.create({ term: 'DRACAU' }));
      const english = await repository.searchByName(
        CardNameSearch.create({ term: 'charizard ex' }),
      );

      expect(french.length).toBeGreaterThan(0);
      expect(french.every((card) => (card.name.fr ?? '').toLowerCase().includes('dracau'))).toBe(
        true,
      );
      expect(english.length).toBeGreaterThan(0);
      expect(
        english.every((card) => card.nameIn('en').toLowerCase().includes('charizard ex')),
      ).toBe(true);
    });

    it('returns each card with the set it belongs to', async () => {
      const cards = await repository.searchByName(CardNameSearch.create({ term: 'charizard' }));

      expect(new Set(cards.map((card) => card.set.name.en))).toEqual(
        new Set(['Base Set', 'Darkness Ablaze', '151']),
      );
    });

    describe('a % _ or \\ typed by the user is text, not a LIKE pattern', () => {
      const search = (term: string) => repository.searchByName(CardNameSearch.create({ term }));
      const tcgdexIds = (cards: readonly Card[]) => cards.map((card) => card.tcgdexId);

      it('matches nothing when the character is a wildcard in disguise', async () => {
        for (const term of ['%%', '__', 'p%', 'a_b']) {
          await expect(search(term)).resolves.toEqual([]);
        }
      });

      it('finds the card that really contains the character, and only that one', async () => {
        expect(tcgdexIds(await search('Zz 100%'))).toEqual([`${CONTRACT_PREFIX}-pct`]);
        expect(tcgdexIds(await search('Zz_Under'))).toEqual([`${CONTRACT_PREFIX}-us`]);
        expect(tcgdexIds(await search('Zz back\\slash'))).toEqual([`${CONTRACT_PREFIX}-bs`]);
      });
    });

    it("treats an apostrophe as a character (Farfetch'd) and applies the limit", async () => {
      const apostrophe = await repository.searchByName(
        CardNameSearch.create({ term: "farfetch'd" }),
      );
      const limited = await repository.searchByName(
        CardNameSearch.create({ term: 'ex', limit: 3 }),
      );

      expect(apostrophe.length).toBeGreaterThan(0);
      expect(limited).toHaveLength(3);
    });
  });
});
