import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { User } from '../../src/modules/auth/domain/entities/User';
import { Password } from '../../src/modules/auth/domain/value-objects/Password';
import { BcryptPasswordHasher } from '../../src/modules/auth/infrastructure/services/BcryptPasswordHasher';
import { POKEMON_LICENCE } from '../catalogue/SeedCatalogue';
import { buildDemoEntries } from './DemoCollectionBuilder';
import {
  DEFAULT_DEMO_PASSWORD,
  DEMO_COLLECTION_MIN_ENTRIES,
  DEMO_COLLECTION_NAME,
  DEMO_TERMS_VERSION,
  DEMO_USERS,
} from './DemoData';
import type { DemoUser } from './DemoData';

/** PASSWORD_MIN_LENGTH default (EnvironmentVariables.ts): the seed does not load the app configuration. */
const DEMO_PASSWORD_MIN_LENGTH = 8;

export interface DemoSeedSummary {
  users: number;
  collections: number;
  cardEntries: number;
}

/** The catalogue as the builder needs it, both lists in a stable order (see buildDemoEntries). */
interface DemoCatalogue {
  cardIds: string[];
  variantIdsByCard: Map<string, string[]>;
}

/**
 * Demo accounts share a publicly known password: they must never exist in production. The seed runs on
 * every environment (reference data), so this decides whether the demo part runs at all.
 */
export function shouldSeedDemoData(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}

async function loadCatalogue(prismaClient: PrismaClient): Promise<DemoCatalogue> {
  const cards = await prismaClient.card.findMany({
    select: { id: true },
    orderBy: { tcgdexId: 'asc' },
  });
  if (cards.length < DEMO_COLLECTION_MIN_ENTRIES) {
    throw new Error(
      `The demo collections need at least ${DEMO_COLLECTION_MIN_ENTRIES} cards in the catalogue, found ${cards.length}: seed the catalogue first`,
    );
  }
  const variants = await prismaClient.variant.findMany({
    select: { id: true, cardId: true },
    orderBy: [{ tcgdexVariantId: 'asc' }, { id: 'asc' }],
  });

  const variantIdsByCard = new Map<string, string[]>();
  for (const { id, cardId } of variants) {
    variantIdsByCard.set(cardId, [...(variantIdsByCard.get(cardId) ?? []), id]);
  }
  return { cardIds: cards.map((card) => card.id), variantIdsByCard };
}

async function seedUser(
  prismaClient: PrismaClient,
  demoUser: DemoUser,
  passwordHash: string,
): Promise<{ id: string; created: boolean }> {
  const existing = await prismaClient.user.findUnique({
    where: { email: demoUser.email },
    select: { id: true },
  });
  if (existing !== null) {
    return { id: existing.id, created: false };
  }

  const role = await prismaClient.role.findUniqueOrThrow({
    where: { name: demoUser.role },
    select: { id: true },
  });
  const created = await prismaClient.user.create({
    data: {
      email: demoUser.email,
      passwordHash,
      username: demoUser.username,
      usernameKey: User.usernameKey(demoUser.username),
      roleId: role.id,
      termsAcceptedAt: new Date(),
      termsVersion: DEMO_TERMS_VERSION,
    },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

async function seedCollection(
  prismaClient: PrismaClient,
  userId: string,
  licenceTCGId: string,
  catalogue: DemoCatalogue,
  seed: number,
): Promise<number> {
  // A collection name is not unique in the schema, so the pair (owner, name) is the natural key of a
  // demo collection. One that already exists is left alone, entries included: someone may have edited it.
  const existing = await prismaClient.collection.findFirst({
    where: { userId, name: DEMO_COLLECTION_NAME },
    select: { id: true },
  });
  if (existing !== null) {
    return 0;
  }

  const entries = buildDemoEntries(seed, catalogue.cardIds, catalogue.variantIdsByCard);
  // The id is generated here so that the collection and its entries go in one transaction: a seed
  // stopped halfway never leaves a half-filled collection that the next run would then skip.
  const collectionId = randomUUID();
  await prismaClient.$transaction([
    prismaClient.collection.create({
      data: { id: collectionId, userId, licenceTCGId, name: DEMO_COLLECTION_NAME },
    }),
    prismaClient.cardEntry.createMany({
      data: entries.map((entry) => ({ collectionId, ...entry })),
    }),
  ]);
  return entries.length;
}

// Demo data only, for development and staging: DEMO_USERS accounts (one admin, the others users), each
// with one collection of 150 to 500 distinct catalogue cards, to exercise pagination, filters and
// limits of the Collection API with a realistic volume. Idempotent and INSERT-ONLY, like the catalogue
// seed: a user is looked up on its email, a collection on (owner, name), and whatever exists is left
// untouched, so a second run creates nothing. Needs the roles and the catalogue to be seeded first.
export async function seedDemoData(
  prismaClient: PrismaClient,
  password: string = DEFAULT_DEMO_PASSWORD,
): Promise<DemoSeedSummary> {
  const hasher = new BcryptPasswordHasher();
  // Same policy as a registration (an empty SEED_DEMO_PASSWORD, for instance, is refused here).
  Password.create(password, DEMO_PASSWORD_MIN_LENGTH, hasher.maxPasswordBytes);

  const licence = await prismaClient.licenceTCG.findUniqueOrThrow({
    where: { slug: POKEMON_LICENCE.slug },
    select: { id: true },
  });
  const catalogue = await loadCatalogue(prismaClient);
  const passwordHash = await hasher.hash(password);

  const summary: DemoSeedSummary = { users: 0, collections: 0, cardEntries: 0 };
  for (const [index, demoUser] of DEMO_USERS.entries()) {
    const user = await seedUser(prismaClient, demoUser, passwordHash);
    summary.users += user.created ? 1 : 0;

    // The position in DEMO_USERS is the seed: the same account always gets the same collection.
    const cardEntries = await seedCollection(
      prismaClient,
      user.id,
      licence.id,
      catalogue,
      index + 1,
    );
    summary.collections += cardEntries > 0 ? 1 : 0;
    summary.cardEntries += cardEntries;
  }
  return summary;
}
