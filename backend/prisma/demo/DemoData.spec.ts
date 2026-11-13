import { randomUUID } from 'node:crypto';
import { Email } from '../../src/modules/auth/domain/value-objects/Email';
import { Password } from '../../src/modules/auth/domain/value-objects/Password';
import { User } from '../../src/modules/auth/domain/entities/User';
import { CardEntry } from '../../src/modules/collection/domain/entities/CardEntry';
import { Collection } from '../../src/modules/collection/domain/entities/Collection';
import { MAX_COLLECTIONS_PER_USER } from '../../src/modules/collection/domain/rules/CollectionLimits';
import { ROLE_NAMES } from '../../src/shared/config/AppConstants';
import { loadReferenceCatalogue } from '../catalogue/CatalogueFixtures';
import { DEFAULT_DEMO_PASSWORD, DEMO_USERS } from './DemoData';

// The demo data must be something the real API could have produced: every value goes through the
// domain rules that the Auth and Collection use cases apply.
describe('DEMO_USERS', () => {
  const catalogueCardIds = new Set(
    loadReferenceCatalogue().flatMap(({ cards }) => cards.map((card) => card.tcgdexId)),
  );

  it('has distinct canonical emails and usernames', () => {
    const emails = DEMO_USERS.map((user) => Email.create(user.email).value);
    const usernameKeys = DEMO_USERS.map((user) => User.usernameKey(user.username));

    expect(new Set(emails).size).toBe(DEMO_USERS.length);
    expect(new Set(usernameKeys).size).toBe(DEMO_USERS.length);
    expect(emails).toEqual(DEMO_USERS.map((user) => user.email));
  });

  it('has valid usernames and a default password that satisfies the policy', () => {
    for (const user of DEMO_USERS) {
      expect(() => User.assertValidUsername(user.username)).not.toThrow();
    }
    expect(() => Password.create(DEFAULT_DEMO_PASSWORD, 8, 72)).not.toThrow();
  });

  it('covers every role', () => {
    expect(new Set(DEMO_USERS.map((user) => user.role))).toEqual(new Set(ROLE_NAMES));
  });

  it('stays under the collection limit with distinct, valid names per owner', () => {
    for (const user of DEMO_USERS) {
      const names = user.collections.map((collection) => collection.name);
      expect(names.length).toBeLessThanOrEqual(MAX_COLLECTIONS_PER_USER);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) {
        expect(() => Collection.assertValidName(name)).not.toThrow();
      }
    }
  });

  it('only holds entries the domain accepts, on cards of the reference catalogue', () => {
    for (const { collections } of DEMO_USERS) {
      for (const { entries } of collections) {
        for (const entry of entries) {
          expect(catalogueCardIds.has(entry.cardTcgdexId)).toBe(true);
          expect(() =>
            CardEntry.create({
              collectionId: randomUUID(),
              cardId: randomUUID(),
              quantity: entry.quantity,
              condition: entry.condition,
              language: entry.language,
              gradingNote: entry.gradingNote,
              notes: entry.notes,
            }),
          ).not.toThrow();
        }
      }
    }
  });

  it('does not list the same card twice in one collection', () => {
    for (const { collections } of DEMO_USERS) {
      for (const { entries } of collections) {
        const keys = entries.map(
          (entry) =>
            `${entry.cardTcgdexId}/${entry.variant?.type ?? ''}/${entry.variant?.subtype ?? ''}/${entry.condition}/${entry.language}`,
        );
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it('only asks for printings that exist in the catalogue', () => {
    const catalogue = loadReferenceCatalogue();
    for (const { collections } of DEMO_USERS) {
      for (const { entries } of collections) {
        for (const { cardTcgdexId, variant } of entries) {
          if (variant === undefined) continue;
          const found = catalogue
            .flatMap((set) => set.variants)
            .some(
              (candidate) =>
                candidate.cardTcgdexId === cardTcgdexId &&
                candidate.type === variant.type &&
                candidate.subtype === variant.subtype &&
                candidate.stamps.length === 0,
            );
          expect(found).toBe(true);
        }
      }
    }
  });

  it('exercises the API: every condition and both languages are used, and one collection is empty', () => {
    const entries = DEMO_USERS.flatMap((user) => user.collections.flatMap((c) => c.entries));

    expect(new Set(entries.map((entry) => entry.condition))).toEqual(
      new Set(['NM', 'LP', 'MP', 'HP', 'DMG']),
    );
    expect(new Set(entries.map((entry) => entry.language))).toEqual(new Set(['fr', 'en']));
    expect(entries.some((entry) => entry.gradingNote !== undefined)).toBe(true);
    expect(DEMO_USERS.some((u) => u.collections.some((c) => c.entries.length === 0))).toBe(true);
  });
});
