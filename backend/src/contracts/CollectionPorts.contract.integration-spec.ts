import { randomUUID } from 'node:crypto';
import { PrismaCardEntryViewReader } from '../modules/collection/infrastructure/repositories/PrismaCardEntryViewReader';
import { PrismaCollectionRepository } from '../modules/collection/infrastructure/repositories/PrismaCollectionRepository';
import { CardEntry } from '../modules/collection/domain/entities/CardEntry';
import { Collection } from '../modules/collection/domain/entities/Collection';
import { PageRequest } from '../modules/collection/domain/value-objects/PageRequest';
import { CardNotFoundError } from '../modules/collection/application/errors/CollectionErrors';
import type { PrismaClient } from '../generated/prisma/client.js';
import { collectionRepositoryContract } from './CollectionPorts.contract';
import type { CollectionContractHarness } from './CollectionPorts.contract';
import { createIntegrationPrisma } from './IntegrationDatabase';

/**
 * COLLR-417: the same behavioural contract as the in-memory repository, run against the real
 * PostgreSQL (opt-in: `npm run test:integration`), plus what only a real store can prove: the
 * composite foreign key, the columns the domain does not model, and the plan of the paged read.
 */
const prisma = createIntegrationPrisma();

afterAll(async () => {
  await prisma.$disconnect();
});

type SeededCatalogue = CollectionContractHarness['catalogue'] & {
  readonly secondVariantOfFirstCardId: string;
};

async function seedLicence(client: PrismaClient): Promise<string> {
  const slug = `it-${randomUUID()}`;
  const licence = await client.licenceTCG.create({ data: { slug, name: slug } });
  return licence.id;
}

async function seedCard(
  client: PrismaClient,
  licenceId: string,
): Promise<{ cardId: string; variantId: string; otherVariantId: string }> {
  const key = randomUUID();
  const set = await client.cardSet.create({
    data: {
      licenceTCGId: licenceId,
      tcgdexId: `it-set-${key}`,
      nameEn: 'Integration set',
      officialCardCount: 1,
      totalCardCount: 1,
    },
  });
  const card = await client.card.create({
    data: {
      setId: set.id,
      tcgdexId: `it-card-${key}`,
      number: '1',
      nameEn: 'Integration card',
      category: 'Pokemon',
    },
  });
  const variant = await client.variant.create({
    data: { cardId: card.id, tcgdexVariantId: 'normal', type: 'normal', size: 'standard' },
  });
  const otherVariant = await client.variant.create({
    data: { cardId: card.id, tcgdexVariantId: 'reverse', type: 'reverse', size: 'standard' },
  });
  return { cardId: card.id, variantId: variant.id, otherVariantId: otherVariant.id };
}

async function seedCatalogue(client: PrismaClient): Promise<SeededCatalogue> {
  const licenceId = await seedLicence(client);
  const otherLicenceId = await seedLicence(client);
  const first = await seedCard(client, licenceId);
  const second = await seedCard(client, licenceId);
  const foreign = await seedCard(client, otherLicenceId);
  return {
    licenceId,
    otherLicenceId,
    cardId: first.cardId,
    variantId: first.variantId,
    secondVariantOfFirstCardId: first.otherVariantId,
    secondCardId: second.cardId,
    secondCardVariantId: second.variantId,
    foreignCardId: foreign.cardId,
  };
}

async function createOwner(client: PrismaClient): Promise<string> {
  const id = randomUUID();
  await client.user.create({
    data: {
      id,
      email: `col${id.slice(0, 8)}@example.com`,
      passwordHash: 'not-a-real-hash',
      username: `col-${id.slice(0, 8)}`,
      usernameKey: `col-${id.slice(0, 8)}`,
      termsAcceptedAt: new Date(),
      termsVersion: '1',
      role: { connect: { name: 'USER' } },
    },
  });
  return id;
}

let catalogue: Promise<SeededCatalogue> | undefined;
const sharedCatalogue = (): Promise<SeededCatalogue> => {
  catalogue ??= seedCatalogue(prisma);
  return catalogue;
};

collectionRepositoryContract('PrismaCollectionRepository (real PostgreSQL)', async () => ({
  repository: new PrismaCollectionRepository(prisma),
  catalogue: await sharedCatalogue(),
  newOwnerId: () => createOwner(prisma),
}));

describe('PrismaCollectionRepository - what only the real store proves (COLLR-417)', () => {
  const repository = new PrismaCollectionRepository(prisma);

  async function newCollection(): Promise<{ collection: Collection; catalogue: SeededCatalogue }> {
    const seeded = await sharedCatalogue();
    const collection = await repository.create(
      Collection.create({
        userId: await createOwner(prisma),
        licenceTCGId: seeded.licenceId,
        name: 'Integration',
      }),
      10,
    );
    return { collection, catalogue: seeded };
  }

  it('keeps gradingResultId, a column the domain does not model, when an entry is updated', async () => {
    const { collection, catalogue: seeded } = await newCollection();
    const entry = CardEntry.create({
      collectionId: collection.id,
      cardId: seeded.cardId,
      quantity: 1,
      condition: 'NM',
      language: 'fr',
    });
    await repository.addCardEntry(entry);
    const gradingResultId = randomUUID();
    await prisma.cardEntry.update({ where: { id: entry.id }, data: { gradingResultId } });

    await repository.updateCardEntry(
      collection.id,
      entry.id,
      CardEntry.validateChanges({ quantity: 4, notes: 'Regraded' }),
    );

    const stored = await prisma.cardEntry.findUniqueOrThrow({ where: { id: entry.id } });
    expect(stored.gradingResultId).toBe(gradingResultId);
    expect(stored.quantity).toBe(4);
    expect(stored.notes).toBe('Regraded');
  });

  it('refuses, in the database itself, a variant that belongs to another card (composite foreign key)', async () => {
    const { collection, catalogue: seeded } = await newCollection();

    await expect(
      prisma.cardEntry.create({
        data: {
          collectionId: collection.id,
          cardId: seeded.cardId,
          variantId: seeded.secondCardVariantId,
          quantity: 1,
          condition: 'NM',
          language: 'fr',
        },
      }),
    ).rejects.toThrow();
    // The same card with one of its own printings is accepted.
    await expect(
      prisma.cardEntry.create({
        data: {
          collectionId: collection.id,
          cardId: seeded.cardId,
          variantId: seeded.secondVariantOfFirstCardId,
          quantity: 1,
          condition: 'NM',
          language: 'fr',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('refuses a quantity or a grading note outside what the domain allows (CHECK constraints)', async () => {
    const { collection, catalogue: seeded } = await newCollection();
    const base = {
      collectionId: collection.id,
      cardId: seeded.cardId,
      condition: 'NM' as const,
      language: 'fr' as const,
    };

    await expect(prisma.cardEntry.create({ data: { ...base, quantity: 0 } })).rejects.toThrow();
    await expect(
      prisma.cardEntry.create({ data: { ...base, quantity: 1, gradingNote: 10.5 } }),
    ).rejects.toThrow();
  });

  it('stores a grading note exactly (decimal(3,1)) and returns it as a number', async () => {
    const { collection, catalogue: seeded } = await newCollection();
    const entry = CardEntry.create({
      collectionId: collection.id,
      cardId: seeded.cardId,
      quantity: 1,
      condition: 'NM',
      language: 'fr',
      gradingNote: 9.5,
    });

    const stored = await repository.addCardEntry(entry);

    expect(stored.gradingNote).toBe(9.5);
  });

  it('reports CardNotFoundError (not a database error) for a card of another licence', async () => {
    const { collection, catalogue: seeded } = await newCollection();
    const entry = CardEntry.create({
      collectionId: collection.id,
      cardId: seeded.foreignCardId,
      quantity: 1,
      condition: 'NM',
      language: 'fr',
    });

    await expect(repository.addCardEntry(entry)).rejects.toBeInstanceOf(CardNotFoundError);
  });

  describe('findCardEntries on 10 000 entries', () => {
    const ENTRY_COUNT = 10_000;
    let collectionId: string;

    beforeAll(async () => {
      const { collection, catalogue: seeded } = await newCollection();
      collectionId = collection.id;
      const now = Date.now();
      await prisma.cardEntry.createMany({
        data: Array.from({ length: ENTRY_COUNT }, (_, i) => ({
          collectionId,
          cardId: seeded.cardId,
          quantity: 1,
          condition: 'NM' as const,
          language: 'fr' as const,
          addedAt: new Date(now - i * 1000),
        })),
      });
      await prisma.$executeRaw`ANALYZE "card_entries"`;
    }, 60_000);

    it('reads any page without loading the collection, in the order of the index', async () => {
      const first = await repository.findCardEntries(collectionId, PageRequest.create());
      const deep = await repository.findCardEntries(
        collectionId,
        PageRequest.create({ page: 100, pageSize: 100 }),
      );

      expect(first.total).toBe(ENTRY_COUNT);
      expect(first.items).toHaveLength(50);
      expect(deep.items).toHaveLength(100);
      const times = deep.items.map((entry) => entry.addedAt.getTime());
      expect(times).toEqual([...times].sort((a, b) => b - a));
    });

    it('answers the paged query from the (collectionId, addedAt, id) index, with no sort step', async () => {
      const plan = await prisma.$queryRaw<{ 'QUERY PLAN': unknown }[]>`
        EXPLAIN (FORMAT JSON)
        SELECT * FROM "card_entries"
        WHERE "collectionId" = ${collectionId}::uuid
        ORDER BY "addedAt" DESC, "id" DESC
        LIMIT 50 OFFSET 0`;
      const text = JSON.stringify(plan);

      expect(text).toContain('card_entries_collectionId_addedAt_id_idx');
      expect(text).not.toContain('"Node Type":"Sort"');
      expect(text).not.toContain('"Node Type":"Seq Scan"');
    });
  });
});

/**
 * A page and its total must come from the same snapshot. Under PostgreSQL's default isolation each
 * statement of the batch sees its own state: an entry committed between the count and the page gave
 * `total: 0` with an item in `items`. Entries are inserted without pause while pages are read; every
 * answer must agree with itself. (A stress test: it cannot fail with the fix, and with the bug it
 * fails as soon as one insert lands between the two statements.)
 */
describe('page reads are a consistent snapshot (COLLR-417)', () => {
  const repository = new PrismaCollectionRepository(prisma);
  const viewReader = new PrismaCardEntryViewReader(prisma);
  const INSERTS = 80;
  const READS = 150;
  const PAGE_SIZE = 100; // above INSERTS: a consistent page lists every entry counted

  it.each([
    [
      'ICollectionRepository.findCardEntries',
      (collectionId: string) =>
        repository.findCardEntries(collectionId, PageRequest.create({ pageSize: PAGE_SIZE })),
    ],
    [
      'ICardEntryViewReader.findCardEntryViews',
      (collectionId: string) =>
        viewReader.findCardEntryViews(collectionId, PageRequest.create({ pageSize: PAGE_SIZE })),
    ],
  ])(
    '%s never answers a total that disagrees with its items',
    async (_name, read) => {
      const seeded = await sharedCatalogue();
      const collection = await repository.create(
        Collection.create({
          userId: await createOwner(prisma),
          licenceTCGId: seeded.licenceId,
          name: 'Snapshot',
        }),
        10,
      );
      let inserting = true;
      const writer = (async () => {
        for (let i = 0; i < INSERTS; i += 1) {
          await prisma.cardEntry.create({
            data: {
              collectionId: collection.id,
              cardId: seeded.cardId,
              quantity: 1,
              condition: 'NM',
              language: 'fr',
            },
          });
        }
        inserting = false;
      })();

      const disagreements: string[] = [];
      for (let i = 0; i < READS && inserting; i += 1) {
        const page = await read(collection.id);
        if (page.items.length !== page.total) {
          disagreements.push(`total ${page.total} for ${page.items.length} items`);
        }
      }
      await writer;

      expect(disagreements).toEqual([]);
    },
    60_000,
  );
});
