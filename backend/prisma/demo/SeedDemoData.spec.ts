import type { PrismaClient } from '../../src/generated/prisma/client.js';
import {
  DEFAULT_DEMO_PASSWORD,
  DEMO_COLLECTION_MAX_ENTRIES,
  DEMO_COLLECTION_MIN_ENTRIES,
  DEMO_COLLECTION_NAME,
  DEMO_TERMS_VERSION,
  DEMO_USERS,
} from './DemoData';
import { seedDemoData, shouldSeedDemoData } from './SeedDemoData';

// A real bcrypt hash at cost 12 takes ~250 ms, twice per call (the hasher also hashes a dummy at
// construction): across this file that exceeds Jest's 5 s timeout when the workers compete for the CPU
// (the pre-push hook runs the whole suite). The hasher has its own specs; here bcrypt is a fast double
// whose output differs from the password, which is all this file relies on.
const fakeHash = (plain: string): string => `hashed(${Buffer.from(plain).toString('base64')})`;
jest.mock('bcrypt', () => ({
  hash: (plain: string) => Promise.resolve(`hashed(${Buffer.from(plain).toString('base64')})`),
  hashSync: () => 'dummy-hash',
  compare: () => Promise.resolve(false),
}));

interface FakeOptions {
  existingEmails?: string[];
  usersWithCollection?: string[];
  cardCount?: number;
}

interface CollectionCreateArgs {
  data: { id: string; userId: string; licenceTCGId: string; name: string };
}
interface CreateManyArgs {
  data: { collectionId: string; cardId: string; variantId: string | null }[];
}

function createFakePrisma(options: FakeOptions = {}) {
  const cardCount = options.cardCount ?? 510;
  const cards = Array.from({ length: cardCount }, (_, index) => ({ id: `card-${index}` }));
  // Two printings per card.
  const variants = cards.flatMap(({ id }) => [
    { id: `${id}-v1`, cardId: id },
    { id: `${id}-v2`, cardId: id },
  ]);

  const userCreate = jest.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: `user-${String(args.data['email'])}` }),
  );
  const collectionCreate = jest.fn((args: CollectionCreateArgs) => Promise.resolve(args.data));
  const entryCreateMany = jest.fn((args: CreateManyArgs) =>
    Promise.resolve({ count: args.data.length }),
  );
  const transaction = jest.fn((operations: Promise<unknown>[]) => Promise.all(operations));

  const prismaClient = {
    user: {
      findUnique: jest.fn((args: { where: { email: string } }) =>
        Promise.resolve(
          options.existingEmails?.includes(args.where.email)
            ? { id: `user-${args.where.email}` }
            : null,
        ),
      ),
      create: userCreate,
    },
    role: {
      findUniqueOrThrow: jest.fn((args: { where: { name: string } }) =>
        Promise.resolve({ id: `role-${args.where.name}` }),
      ),
    },
    licenceTCG: { findUniqueOrThrow: jest.fn(() => Promise.resolve({ id: 'licence-id' })) },
    collection: {
      findFirst: jest.fn((args: { where: { userId: string } }) =>
        Promise.resolve(
          options.usersWithCollection?.includes(args.where.userId) ? { id: 'existing' } : null,
        ),
      ),
      create: collectionCreate,
    },
    card: { findMany: jest.fn(() => Promise.resolve(cards)) },
    variant: { findMany: jest.fn(() => Promise.resolve(variants)) },
    cardEntry: { createMany: entryCreateMany },
    $transaction: transaction,
  } as unknown as PrismaClient;

  return { prismaClient, userCreate, collectionCreate, entryCreateMany, transaction };
}

describe('shouldSeedDemoData', () => {
  it.each([undefined, 'development', 'test'])('seeds when NODE_ENV is %s', (nodeEnv) => {
    expect(shouldSeedDemoData(nodeEnv)).toBe(true);
  });

  it('never seeds in production', () => {
    expect(shouldSeedDemoData('production')).toBe(false);
  });
});

describe('seedDemoData', () => {
  it('creates every user with one filled collection on an empty database and reports it', async () => {
    const { prismaClient, userCreate, collectionCreate, entryCreateMany } = createFakePrisma();

    const summary = await seedDemoData(prismaClient);

    expect(summary.users).toBe(DEMO_USERS.length);
    expect(summary.collections).toBe(DEMO_USERS.length);
    expect(userCreate).toHaveBeenCalledTimes(DEMO_USERS.length);
    expect(collectionCreate).toHaveBeenCalledTimes(DEMO_USERS.length);
    const inserted = entryCreateMany.mock.calls.reduce((sum, [args]) => sum + args.data.length, 0);
    expect(summary.cardEntries).toBe(inserted);
  });

  it('stores accounts the way a registration does: canonical key, role by name, terms, hashed password', async () => {
    const { prismaClient, userCreate } = createFakePrisma();

    await seedDemoData(prismaClient);

    const [admin] = userCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(admin.data).toMatchObject({
      email: 'admin@collectionr.test',
      username: 'admin',
      usernameKey: 'admin',
      roleId: 'role-ADMIN',
      termsVersion: DEMO_TERMS_VERSION,
    });
    const hash = String(admin.data['passwordHash']);
    expect(hash).not.toContain(DEFAULT_DEMO_PASSWORD);
    expect(hash).toBe(fakeHash(DEFAULT_DEMO_PASSWORD));
    const roles = userCreate.mock.calls.map(
      ([args]) => (args as { data: { roleId: string } }).data.roleId,
    );
    expect(roles.filter((role) => role === 'role-USER')).toHaveLength(DEMO_USERS.length - 1);
  });

  it('gives each user one collection on the Pokémon licence, holding 150 to 500 distinct cards', async () => {
    const { prismaClient, collectionCreate, entryCreateMany } = createFakePrisma();

    await seedDemoData(prismaClient);

    expect(collectionCreate).toHaveBeenCalledTimes(DEMO_USERS.length);
    DEMO_USERS.forEach((user, index) => {
      const [collection] = collectionCreate.mock.calls[index];
      const [entries] = entryCreateMany.mock.calls[index];
      expect(collection.data).toMatchObject({
        userId: `user-${user.email}`,
        licenceTCGId: 'licence-id',
        name: DEMO_COLLECTION_NAME,
      });
      expect(entries.data.length).toBeGreaterThanOrEqual(DEMO_COLLECTION_MIN_ENTRIES);
      expect(entries.data.length).toBeLessThanOrEqual(DEMO_COLLECTION_MAX_ENTRIES);
      expect(new Set(entries.data.map((entry) => entry.cardId)).size).toBe(entries.data.length);
      for (const entry of entries.data) {
        expect(entry.collectionId).toBe(collection.data.id);
        if (entry.variantId !== null) {
          expect(entry.variantId.startsWith(entry.cardId)).toBe(true);
        }
      }
    });
  });

  it('writes a collection and its entries in one transaction', async () => {
    const { prismaClient, transaction } = createFakePrisma();

    await seedDemoData(prismaClient);

    expect(transaction).toHaveBeenCalledTimes(DEMO_USERS.length);
  });

  it('sends the very same data every time (deterministic)', async () => {
    const first = createFakePrisma();
    const second = createFakePrisma();

    await seedDemoData(first.prismaClient);
    await seedDemoData(second.prismaClient);

    expect(
      second.entryCreateMany.mock.calls.map(([args]) => args.data.map((e) => e.cardId)),
    ).toEqual(first.entryCreateMany.mock.calls.map(([args]) => args.data.map((e) => e.cardId)));
  });

  it('creates nothing when everything already exists (idempotent)', async () => {
    const { prismaClient, userCreate, collectionCreate, entryCreateMany } = createFakePrisma({
      existingEmails: DEMO_USERS.map((user) => user.email),
      usersWithCollection: DEMO_USERS.map((user) => `user-${user.email}`),
    });

    await expect(seedDemoData(prismaClient)).resolves.toEqual({
      users: 0,
      collections: 0,
      cardEntries: 0,
    });
    expect(userCreate).not.toHaveBeenCalled();
    expect(collectionCreate).not.toHaveBeenCalled();
    expect(entryCreateMany).not.toHaveBeenCalled();
  });

  it('adds only what is missing', async () => {
    const [first] = DEMO_USERS;
    const { prismaClient, userCreate, collectionCreate } = createFakePrisma({
      existingEmails: [first.email],
      usersWithCollection: [`user-${first.email}`],
    });

    const summary = await seedDemoData(prismaClient);

    expect(summary.users).toBe(DEMO_USERS.length - 1);
    expect(summary.collections).toBe(DEMO_USERS.length - 1);
    expect(userCreate).toHaveBeenCalledTimes(DEMO_USERS.length - 1);
    expect(collectionCreate).toHaveBeenCalledTimes(DEMO_USERS.length - 1);
  });

  it('fails with a clear message when the catalogue is too small, before writing anything', async () => {
    const { prismaClient, userCreate } = createFakePrisma({ cardCount: 10 });

    await expect(seedDemoData(prismaClient)).rejects.toThrow('seed the catalogue first');
    expect(userCreate).not.toHaveBeenCalled();
  });

  it('refuses a password the policy would refuse at registration', async () => {
    const { prismaClient, userCreate } = createFakePrisma();

    await expect(seedDemoData(prismaClient, '')).rejects.toThrow('at least 8 characters');
    expect(userCreate).not.toHaveBeenCalled();
  });
});
