import type { PrismaClient } from '../../src/generated/prisma/client.js';
import { User } from '../../src/modules/auth/domain/entities/User';
import { Password } from '../../src/modules/auth/domain/value-objects/Password';
import { parseCardCondition } from '../../src/modules/collection/domain/value-objects/CardCondition';
import { parseCardLanguage } from '../../src/modules/collection/domain/value-objects/CardLanguage';
import { BcryptPasswordHasher } from '../../src/modules/auth/infrastructure/services/BcryptPasswordHasher';
import { POKEMON_LICENCE } from '../catalogue/SeedCatalogue';
import { DEFAULT_DEMO_PASSWORD, DEMO_TERMS_VERSION, DEMO_USERS } from './DemoData';
import type { DemoCardEntry, DemoCollection, DemoUser } from './DemoData';

/** PASSWORD_MIN_LENGTH default (EnvironmentVariables.ts): the seed does not load the app configuration. */
const DEMO_PASSWORD_MIN_LENGTH = 8;

export interface DemoSeedSummary {
  users: number;
  collections: number;
  cardEntries: number;
}

/**
 * Demo accounts share a publicly known password: they must never exist in production. The seed runs on
 * every environment (reference data), so this decides whether the demo part runs at all.
 */
export function shouldSeedDemoData(nodeEnv: string | undefined): boolean {
  return nodeEnv !== 'production';
}

async function findVariantId(
  prismaClient: PrismaClient,
  cardId: string,
  entry: DemoCardEntry,
): Promise<string | null> {
  if (entry.variant === undefined) {
    return null;
  }
  const variant = await prismaClient.variant.findFirst({
    where: {
      cardId,
      type: entry.variant.type,
      subtype: entry.variant.subtype,
      stamps: { isEmpty: true },
    },
    select: { id: true },
  });
  if (variant === null) {
    throw new Error(
      `Demo card ${entry.cardTcgdexId} has no ${entry.variant.type}/${String(entry.variant.subtype)} printing in the catalogue`,
    );
  }
  return variant.id;
}

async function seedCollection(
  prismaClient: PrismaClient,
  userId: string,
  licenceTCGId: string,
  collection: DemoCollection,
): Promise<{ created: boolean; cardEntries: number }> {
  // A collection name is not unique in the schema, so the pair (owner, name) is the natural key of a
  // demo collection. One that already exists is left alone, entries included: someone may have edited it.
  const existing = await prismaClient.collection.findFirst({
    where: { userId, name: collection.name },
    select: { id: true },
  });
  if (existing !== null) {
    return { created: false, cardEntries: 0 };
  }

  const cardEntries = [];
  for (const entry of collection.entries) {
    const card = await prismaClient.card.findUnique({
      where: { tcgdexId: entry.cardTcgdexId },
      select: { id: true },
    });
    if (card === null) {
      throw new Error(`Demo card ${entry.cardTcgdexId} is not in the catalogue: seed it first`);
    }
    cardEntries.push({
      cardId: card.id,
      variantId: await findVariantId(prismaClient, card.id, entry),
      quantity: entry.quantity,
      condition: parseCardCondition(entry.condition),
      language: parseCardLanguage(entry.language),
      gradingNote: entry.gradingNote ?? null,
      notes: entry.notes ?? null,
    });
  }

  await prismaClient.collection.create({
    data: {
      userId,
      licenceTCGId,
      name: collection.name,
      cardEntries: { create: cardEntries },
    },
  });
  return { created: true, cardEntries: cardEntries.length };
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

// Demo data only, for development and staging: accounts of each role and collections that exercise the
// Collection API (several conditions and languages, graded and ungraded cards, printings, an empty
// collection). Idempotent and INSERT-ONLY, like the catalogue seed: a user is looked up on its email, a
// collection on (owner, name), and whatever exists is left untouched, so a second run creates nothing.
// Needs the roles and the catalogue to be seeded first (seedRoles, seedCatalogue).
export async function seedDemoData(
  prismaClient: PrismaClient,
  password: string = DEFAULT_DEMO_PASSWORD,
): Promise<DemoSeedSummary> {
  const licence = await prismaClient.licenceTCG.findUniqueOrThrow({
    where: { slug: POKEMON_LICENCE.slug },
    select: { id: true },
  });
  const hasher = new BcryptPasswordHasher();
  // Same policy as a registration (an empty SEED_DEMO_PASSWORD, for instance, is refused here).
  Password.create(password, DEMO_PASSWORD_MIN_LENGTH, hasher.maxPasswordBytes);
  const passwordHash = await hasher.hash(password);

  const summary: DemoSeedSummary = { users: 0, collections: 0, cardEntries: 0 };
  for (const demoUser of DEMO_USERS) {
    const user = await seedUser(prismaClient, demoUser, passwordHash);
    summary.users += user.created ? 1 : 0;

    for (const collection of demoUser.collections) {
      const result = await seedCollection(prismaClient, user.id, licence.id, collection);
      summary.collections += result.created ? 1 : 0;
      summary.cardEntries += result.cardEntries;
    }
  }
  return summary;
}
