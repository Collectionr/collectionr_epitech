import { Email } from '../../src/modules/auth/domain/value-objects/Email';
import { Password } from '../../src/modules/auth/domain/value-objects/Password';
import { User } from '../../src/modules/auth/domain/entities/User';
import { Collection } from '../../src/modules/collection/domain/entities/Collection';
import { ROLE_NAMES } from '../../src/shared/config/AppConstants';
import { loadReferenceCatalogue } from '../catalogue/CatalogueFixtures';
import {
  DEFAULT_DEMO_PASSWORD,
  DEMO_COLLECTION_MAX_ENTRIES,
  DEMO_COLLECTION_MIN_ENTRIES,
  DEMO_COLLECTION_NAME,
  DEMO_USERS,
} from './DemoData';

// The demo data must be something the real API could have produced: every value goes through the
// domain rules that the Auth and Collection use cases apply.
describe('DEMO_USERS', () => {
  it('has ten accounts', () => {
    expect(DEMO_USERS).toHaveLength(10);
  });

  it('has simple emails, already in canonical form and distinct', () => {
    const emails = DEMO_USERS.map((user) => user.email);

    expect(emails).toEqual([
      'admin@collectionr.test',
      ...Array.from({ length: 9 }, (_, index) => `user${index + 1}@collectionr.test`),
    ]);
    expect(emails.map((email) => Email.create(email).value)).toEqual(emails);
  });

  it('has valid usernames that stay distinct once canonicalized', () => {
    for (const user of DEMO_USERS) {
      expect(() => User.assertValidUsername(user.username)).not.toThrow();
    }
    const keys = DEMO_USERS.map((user) => User.usernameKey(user.username));
    expect(new Set(keys).size).toBe(DEMO_USERS.length);
  });

  it('uses roles that exist, with one admin', () => {
    for (const user of DEMO_USERS) {
      expect(ROLE_NAMES).toContain(user.role);
    }
    expect(DEMO_USERS.filter((user) => user.role === 'ADMIN')).toHaveLength(1);
  });
});

describe('demo settings', () => {
  it('has a simple default password that satisfies the password policy', () => {
    expect(DEFAULT_DEMO_PASSWORD).toBe('Test!1234');
    expect(() => Password.create(DEFAULT_DEMO_PASSWORD, 8, 72)).not.toThrow();
  });

  it('has a valid collection name', () => {
    expect(() => Collection.assertValidName(DEMO_COLLECTION_NAME)).not.toThrow();
  });

  it('asks for collections the reference catalogue is big enough to fill', () => {
    const cardCount = loadReferenceCatalogue().reduce(
      (total, { cards }) => total + cards.length,
      0,
    );

    expect(DEMO_COLLECTION_MIN_ENTRIES).toBe(150);
    expect(DEMO_COLLECTION_MAX_ENTRIES).toBe(500);
    expect(DEMO_COLLECTION_MAX_ENTRIES).toBeLessThanOrEqual(cardCount);
  });
});
