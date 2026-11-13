import type { RoleName } from '../../src/shared/config/AppConstants';

// Demo accounts (COLLR-688), as plain data so DemoData.spec.ts can check them against the domain rules
// without a database. Each account owns one collection, filled with cards of the catalogue by
// DemoCollectionBuilder.ts.
//
// NEVER seeded in production (see shouldSeedDemoData): these accounts have a publicly known password.

/** Password of every demo account. Overridable with SEED_DEMO_PASSWORD (must satisfy the password policy). */
export const DEFAULT_DEMO_PASSWORD = 'Test!1234';

/** Version of the terms the demo accounts "accepted": the one the app ships with (TERMS_VERSION default). */
export const DEMO_TERMS_VERSION = '1';

/** Name of the one collection each demo account owns. With the owner, it is the key that makes the seed idempotent. */
export const DEMO_COLLECTION_NAME = 'Ma collection';

/** Each collection holds a random number of distinct cards in this range (both ends included). */
export const DEMO_COLLECTION_MIN_ENTRIES = 150;
export const DEMO_COLLECTION_MAX_ENTRIES = 500;

export interface DemoUser {
  readonly email: string;
  readonly username: string;
  readonly role: RoleName;
}

const DEMO_USER_COUNT = 10;
const EMAIL_DOMAIN = 'collectionr.test';

// admin@, then user1@ to user9@: simple to type on a login form.
export const DEMO_USERS: readonly DemoUser[] = Array.from(
  { length: DEMO_USER_COUNT },
  (_, index) =>
    index === 0
      ? { email: `admin@${EMAIL_DOMAIN}`, username: 'admin', role: 'ADMIN' }
      : { email: `user${index}@${EMAIL_DOMAIN}`, username: `user${index}`, role: 'USER' },
);
