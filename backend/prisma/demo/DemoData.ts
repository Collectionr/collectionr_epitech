import type { RoleName } from '../../src/shared/config/AppConstants';

// Demo accounts and collections (COLLR-688), as plain data so DemoData.spec.ts can check every value
// against the domain rules without a database. Cards are named by their TCGdex id: the seed resolves
// them in the catalogue (prisma/fixtures/tcgdex), so ids are never hard-coded and differ per database.
//
// NEVER seeded in production (see shouldSeedDemoData): these accounts have a publicly known password.

/** Password of every demo account. Overridable with SEED_DEMO_PASSWORD (must satisfy the password policy). */
export const DEFAULT_DEMO_PASSWORD = 'Collectionr-Demo-1';

/** Version of the terms the demo accounts "accepted": the one the app ships with (TERMS_VERSION default). */
export const DEMO_TERMS_VERSION = '1';

/** Picks one printing of a card: the first one of this kind without stamp (1st edition, snowflake...). */
export interface DemoVariant {
  readonly type: string;
  readonly subtype: string | null;
}

export interface DemoCardEntry {
  /** TCGdex id of a card of the reference catalogue (e.g. base1-4). */
  readonly cardTcgdexId: string;
  readonly variant?: DemoVariant;
  readonly quantity: number;
  readonly condition: string;
  readonly language: string;
  readonly gradingNote?: number;
  readonly notes?: string;
}

export interface DemoCollection {
  readonly name: string;
  readonly entries: readonly DemoCardEntry[];
}

export interface DemoUser {
  readonly email: string;
  readonly username: string;
  readonly role: RoleName;
  readonly collections: readonly DemoCollection[];
}

const BASE_SET_HOLO: DemoVariant = { type: 'holo', subtype: 'unlimited' };

export const DEMO_USERS: readonly DemoUser[] = [
  {
    email: 'ash.ketchum@collectionr.test',
    username: 'Ash Ketchum',
    role: 'USER',
    collections: [
      {
        name: 'Charizard',
        entries: [
          {
            cardTcgdexId: 'base1-4',
            variant: BASE_SET_HOLO,
            quantity: 1,
            condition: 'LP',
            language: 'en',
            gradingNote: 7.5,
            notes: 'Base Set unlimited, bought at a card fair in 2019.',
          },
          { cardTcgdexId: 'swsh3-19', quantity: 2, condition: 'NM', language: 'en' },
          {
            cardTcgdexId: 'swsh3-20',
            quantity: 1,
            condition: 'NM',
            language: 'fr',
            gradingNote: 9.5,
          },
          { cardTcgdexId: 'sv03.5-006', quantity: 3, condition: 'NM', language: 'fr' },
        ],
      },
      {
        name: 'Base Set',
        entries: [
          {
            cardTcgdexId: 'base1-15',
            variant: BASE_SET_HOLO,
            quantity: 1,
            condition: 'MP',
            language: 'en',
          },
          {
            cardTcgdexId: 'base1-10',
            quantity: 1,
            condition: 'HP',
            language: 'en',
            notes: 'Creased corner.',
          },
          { cardTcgdexId: 'base1-58', quantity: 4, condition: 'DMG', language: 'en' },
        ],
      },
      { name: 'Wishlist (empty)', entries: [] },
    ],
  },
  {
    email: 'misty.williams@collectionr.test',
    username: 'Misty',
    role: 'USER',
    collections: [
      {
        name: 'Water Pokémon',
        entries: [
          {
            cardTcgdexId: 'base1-2',
            variant: BASE_SET_HOLO,
            quantity: 1,
            condition: 'LP',
            language: 'fr',
          },
          { cardTcgdexId: 'sv03.5-009', quantity: 2, condition: 'NM', language: 'en' },
        ],
      },
      {
        name: 'Pikachu',
        entries: [
          { cardTcgdexId: 'sv03.5-025', quantity: 5, condition: 'NM', language: 'fr' },
          {
            cardTcgdexId: 'sv03.5-173',
            quantity: 1,
            condition: 'NM',
            language: 'en',
            gradingNote: 10,
          },
        ],
      },
    ],
  },
  {
    email: 'admin@collectionr.test',
    username: 'Professor Oak',
    role: 'ADMIN',
    collections: [
      {
        name: 'Psychic and Ghost',
        entries: [
          { cardTcgdexId: 'sv03.5-150', quantity: 1, condition: 'NM', language: 'en' },
          { cardTcgdexId: 'sv03.5-094', quantity: 2, condition: 'LP', language: 'fr' },
        ],
      },
    ],
  },
];
