import { compare } from 'bcrypt';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { DEFAULT_DEMO_PASSWORD, DEMO_TERMS_VERSION, DEMO_USERS } from './DemoData';
import { seedDemoData, shouldSeedDemoData } from './SeedDemoData';

interface FakeOptions {
  existingEmails?: string[];
  existingCollections?: string[];
  missingCardId?: string;
  noVariant?: boolean;
}

function createFakePrisma(options: FakeOptions = {}) {
  const userCreate = jest.fn((args: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: `user-${String(args.data['email'])}` }),
  );
  const collectionCreate = jest.fn(() => Promise.resolve({}));
  const userFindUnique = jest.fn((args: { where: { email: string } }) =>
    Promise.resolve(
      options.existingEmails?.includes(args.where.email)
        ? { id: `user-${args.where.email}` }
        : null,
    ),
  );
  const collectionFindFirst = jest.fn((args: { where: { name: string } }) =>
    Promise.resolve(options.existingCollections?.includes(args.where.name) ? { id: 'c' } : null),
  );
  const cardFindUnique = jest.fn((args: { where: { tcgdexId: string } }) =>
    Promise.resolve(
      args.where.tcgdexId === options.missingCardId ? null : { id: `card-${args.where.tcgdexId}` },
    ),
  );
  const variantFindFirst = jest.fn((args: { where: { cardId: string } }) =>
    Promise.resolve(options.noVariant ? null : { id: `variant-${args.where.cardId}` }),
  );
  const roleFindUniqueOrThrow = jest.fn((args: { where: { name: string } }) =>
    Promise.resolve({ id: `role-${args.where.name}` }),
  );
  const licenceFindUniqueOrThrow = jest.fn(() => Promise.resolve({ id: 'licence-id' }));

  const prismaClient = {
    user: { findUnique: userFindUnique, create: userCreate },
    role: { findUniqueOrThrow: roleFindUniqueOrThrow },
    licenceTCG: { findUniqueOrThrow: licenceFindUniqueOrThrow },
    collection: { findFirst: collectionFindFirst, create: collectionCreate },
    card: { findUnique: cardFindUnique },
    variant: { findFirst: variantFindFirst },
  } as unknown as PrismaClient;

  return { prismaClient, userCreate, collectionCreate, variantFindFirst };
}

const COLLECTION_COUNT = DEMO_USERS.reduce((total, user) => total + user.collections.length, 0);
const ENTRY_COUNT = DEMO_USERS.reduce(
  (total, user) => total + user.collections.reduce((sum, c) => sum + c.entries.length, 0),
  0,
);

describe('shouldSeedDemoData', () => {
  it.each([undefined, 'development', 'test'])('seeds when NODE_ENV is %s', (nodeEnv) => {
    expect(shouldSeedDemoData(nodeEnv)).toBe(true);
  });

  it('never seeds in production', () => {
    expect(shouldSeedDemoData('production')).toBe(false);
  });
});

describe('seedDemoData', () => {
  it('creates every user, collection and entry on an empty database and reports it', async () => {
    const { prismaClient, userCreate, collectionCreate } = createFakePrisma();

    await expect(seedDemoData(prismaClient)).resolves.toEqual({
      users: DEMO_USERS.length,
      collections: COLLECTION_COUNT,
      cardEntries: ENTRY_COUNT,
    });
    expect(userCreate).toHaveBeenCalledTimes(DEMO_USERS.length);
    expect(collectionCreate).toHaveBeenCalledTimes(COLLECTION_COUNT);
  });

  it('stores accounts the way a registration does: canonical key, role by name, terms, hashed password', async () => {
    const { prismaClient, userCreate } = createFakePrisma();

    await seedDemoData(prismaClient);

    const [first] = userCreate.mock.calls[0] as [{ data: Record<string, unknown> }];
    expect(first.data).toMatchObject({
      email: 'ash.ketchum@collectionr.test',
      username: 'Ash Ketchum',
      usernameKey: 'ash ketchum',
      roleId: 'role-USER',
      termsVersion: DEMO_TERMS_VERSION,
    });
    const hash = String(first.data['passwordHash']);
    expect(hash).not.toContain(DEFAULT_DEMO_PASSWORD);
    await expect(compare(DEFAULT_DEMO_PASSWORD, hash)).resolves.toBe(true);
    const roles = userCreate.mock.calls.map(
      ([args]) => (args as { data: { roleId: string } }).data.roleId,
    );
    expect(roles).toContain('role-ADMIN');
  });

  it('attaches collections to their owner and to the Pokémon licence, with resolved card ids', async () => {
    const { prismaClient, collectionCreate } = createFakePrisma();

    await seedDemoData(prismaClient);

    const calls = collectionCreate.mock.calls as unknown as [
      {
        data: {
          userId: string;
          licenceTCGId: string;
          name: string;
          cardEntries: { create: { cardId: string; variantId: string | null }[] };
        };
      },
    ][];
    expect(calls[0][0].data).toMatchObject({
      userId: 'user-ash.ketchum@collectionr.test',
      licenceTCGId: 'licence-id',
      name: 'Charizard',
    });
    const firstEntry = calls[0][0].data.cardEntries.create[0];
    expect(firstEntry.cardId).toBe('card-base1-4');
    expect(firstEntry.variantId).toBe('variant-card-base1-4');
    expect(calls[0][0].data.cardEntries.create[1].variantId).toBeNull();
  });

  it('creates nothing when everything already exists (idempotent)', async () => {
    const { prismaClient, userCreate, collectionCreate } = createFakePrisma({
      existingEmails: DEMO_USERS.map((user) => user.email),
      existingCollections: DEMO_USERS.flatMap((user) => user.collections.map((c) => c.name)),
    });

    await expect(seedDemoData(prismaClient)).resolves.toEqual({
      users: 0,
      collections: 0,
      cardEntries: 0,
    });
    expect(userCreate).not.toHaveBeenCalled();
    expect(collectionCreate).not.toHaveBeenCalled();
  });

  it('adds only what is missing', async () => {
    const [first] = DEMO_USERS;
    const { prismaClient, userCreate, collectionCreate } = createFakePrisma({
      existingEmails: [first.email],
      existingCollections: [first.collections[0].name],
    });

    const summary = await seedDemoData(prismaClient);

    expect(summary.users).toBe(DEMO_USERS.length - 1);
    expect(summary.collections).toBe(COLLECTION_COUNT - 1);
    expect(userCreate).toHaveBeenCalledTimes(DEMO_USERS.length - 1);
    expect(collectionCreate).toHaveBeenCalledTimes(COLLECTION_COUNT - 1);
  });

  it('fails with a clear message when a demo card is not in the catalogue', async () => {
    const { prismaClient } = createFakePrisma({ missingCardId: 'base1-4' });

    await expect(seedDemoData(prismaClient)).rejects.toThrow('base1-4 is not in the catalogue');
  });

  it('fails with a clear message when a demo printing does not exist', async () => {
    const { prismaClient } = createFakePrisma({ noVariant: true });

    await expect(seedDemoData(prismaClient)).rejects.toThrow('has no holo/unlimited printing');
  });

  it('refuses a password the policy would refuse at registration', async () => {
    const { prismaClient, userCreate } = createFakePrisma();

    await expect(seedDemoData(prismaClient, '')).rejects.toThrow('at least 8 characters');
    expect(userCreate).not.toHaveBeenCalled();
  });
});
