// Injected before AppModule loads (see AuthController.e2e-spec.ts): the global limiter is not under test.
process.env.THROTTLE_LIMIT = '100000';
// Each test registers its own accounts: the registration limiter is not what is under test.
process.env.AUTH_REGISTER_RATE_LIMIT = '1000';

import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { AuditEntry } from '../../src/modules/audit/domain/entities/AuditEntry';
import { InMemoryCollectionRepository } from '../../src/contracts/InMemoryCollectionRepository';
import { CARD_ENTRY_VIEW_READER } from '../../src/modules/collection/application/ports/ICardEntryViewReader';
import type {
  CardEntryView,
  ICardEntryViewReader,
} from '../../src/modules/collection/application/ports/ICardEntryViewReader';
import { COLLECTION_REPOSITORY } from '../../src/modules/collection/application/ports/ICollectionRepository';
import type { Page } from '../../src/modules/collection/application/ports/Page';
import type { PageRequest } from '../../src/modules/collection/domain/value-objects/PageRequest';
import { createAuthTestApp } from '../auth/AuthTestDoubles';
import type { AuthTestContext } from '../auth/AuthTestDoubles';

const licenceId = randomUUID();
const otherLicenceId = randomUUID();
const cardId = randomUUID();
const variantId = randomUUID();
const secondCardId = randomUUID();
const foreignCardId = randomUUID();

const repository = new InMemoryCollectionRepository({
  licences: new Set([licenceId, otherLicenceId]),
  cards: new Map([
    [cardId, licenceId],
    [secondCardId, licenceId],
    [foreignCardId, otherLicenceId],
  ]),
  variants: new Map([[variantId, cardId]]),
});

/** The catalogue join of the real reader, replaced by fixed catalogue data for the same entries. */
const viewReader: ICardEntryViewReader = {
  async findCardEntryViews(collectionId: string, page: PageRequest): Promise<Page<CardEntryView>> {
    const entries = await repository.findCardEntries(collectionId, page);
    return {
      ...entries,
      items: entries.items.map((entry) => ({
        entry,
        card: {
          id: entry.cardId,
          number: '006',
          nameEn: 'Charizard',
          nameFr: 'Dracaufeu',
          category: 'Pokemon',
          rarity: 'Holo Rare',
          imageUrlEn: 'https://assets.tcgdex.net/en/base/base1/4',
          imageUrlFr: null,
        },
        set: {
          id: randomUUID(),
          tcgdexId: 'base1',
          nameEn: 'Base Set',
          nameFr: 'Set de Base',
          abbreviationOfficial: null,
        },
        variant:
          entry.variantId === null
            ? null
            : {
                id: entry.variantId,
                type: 'holo',
                subtype: null,
                size: 'standard',
                stamps: [],
                foil: null,
              },
      })),
    };
  },
};

// Real bcrypt (cost 12) on every registration.
jest.setTimeout(60_000);

describe('CollectionsController (e2e)', () => {
  let context: AuthTestContext;
  const http = (): ReturnType<typeof request> => request(context.app.getHttpServer());

  beforeAll(async () => {
    context = await createAuthTestApp({
      overrides: [
        { token: COLLECTION_REPOSITORY, value: repository },
        { token: CARD_ENTRY_VIEW_READER, value: viewReader },
      ],
    });
  });

  afterAll(async () => {
    await context.app.close();
  });

  beforeEach(() => {
    context.audit.mockClear();
    context.redis.resetCounters();
  });

  /** Registration is audited too: only what this controller recorded is under test. */
  const collectionAudits = (): AuditEntry[] =>
    context.audit.mock.calls
      .map(([entry]) => entry)
      .filter((entry) => entry.action.startsWith('collection.'));

  let accounts = 0;
  /** A real account in the store and an access token for it. */
  async function account(): Promise<{ id: string; auth: [string, string] }> {
    accounts += 1;
    const response = await http()
      .post('/api/v1/auth/register')
      .send({
        email: `collector${accounts}@example.com`,
        password: 'Str0ngPassw0rd!',
        username: `collector_${String(accounts).padStart(4, '0')}`,
        acceptedTermsVersion: '1',
      });
    const { id } = response.body as { id: string };
    const pair = await context.tokens.issueTokenPair(id);
    return { id, auth: ['Authorization', `Bearer ${pair.accessToken}`] };
  }

  async function createCollection(
    auth: [string, string],
    name = 'Ma collection',
    licence = licenceId,
  ): Promise<{ id: string }> {
    const response = await http()
      .post('/api/v1/collections')
      .set(...auth)
      .send({ licenceTCGId: licence, name });
    return response.body as { id: string };
  }

  const validEntry = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    cardId,
    quantity: 2,
    condition: 'NM',
    language: 'fr',
    ...overrides,
  });

  describe('authentication', () => {
    it.each([
      ['POST', '/api/v1/collections'],
      ['GET', '/api/v1/collections'],
      ['GET', `/api/v1/collections/${randomUUID()}`],
      ['PATCH', `/api/v1/collections/${randomUUID()}`],
      ['DELETE', `/api/v1/collections/${randomUUID()}`],
      ['GET', `/api/v1/collections/${randomUUID()}/cards`],
      ['POST', `/api/v1/collections/${randomUUID()}/cards`],
      ['PATCH', `/api/v1/collections/${randomUUID()}/cards/${randomUUID()}`],
      ['DELETE', `/api/v1/collections/${randomUUID()}/cards/${randomUUID()}`],
    ])('answers 401 to %s %s without a token', async (method, path) => {
      const response = await http()[method.toLowerCase() as 'get'](path);

      expect(response.status).toBe(401);
    });
  });

  describe('collections', () => {
    it('creates a collection owned by the caller, and never exposes the owner', async () => {
      const { auth } = await account();

      const response = await http()
        .post('/api/v1/collections')
        .set(...auth)
        .send({ licenceTCGId: licenceId, name: '  Ma collection  ' });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ name: 'Ma collection', licenceTCGId: licenceId });
      expect(response.body).not.toHaveProperty('userId');
    });

    it('refuses an owner supplied in the body (400): the owner is the session user', async () => {
      const { auth } = await account();

      const response = await http()
        .post('/api/v1/collections')
        .set(...auth)
        .send({ licenceTCGId: licenceId, name: 'Mine', userId: randomUUID() });

      expect(response.status).toBe(400);
    });

    it.each([
      ['an empty name', { licenceTCGId: licenceId, name: '' }],
      ['a name of 61 characters', { licenceTCGId: licenceId, name: 'a'.repeat(61) }],
      ['a name with an invisible character', { licenceTCGId: licenceId, name: 'a​b' }],
      ['a malformed licence id', { licenceTCGId: 'pokemon', name: 'Ok' }],
      ['no body', {}],
    ])('answers 400 to %s', async (_label, body) => {
      const { auth } = await account();

      const response = await http()
        .post('/api/v1/collections')
        .set(...auth)
        .send(body);

      expect(response.status).toBe(400);
    });

    it('answers 404 to an unknown licence', async () => {
      const { auth } = await account();

      const response = await http()
        .post('/api/v1/collections')
        .set(...auth)
        .send({ licenceTCGId: randomUUID(), name: 'Nope' });

      expect(response.status).toBe(404);
    });

    it('answers 409 to the 11th collection of a user, not to another user', async () => {
      const first = await account();
      for (let i = 0; i < 10; i += 1) {
        await createCollection(first.auth, `C${i}`);
      }

      const refused = await http()
        .post('/api/v1/collections')
        .set(...first.auth)
        .send({ licenceTCGId: licenceId, name: 'One too many' });
      const other = await account();
      const accepted = await createCollection(other.auth);

      expect(refused.status).toBe(409);
      expect(accepted.id).toBeDefined();
    });

    it("lists only the caller's collections, which must not be cached", async () => {
      const mine = await account();
      const theirs = await account();
      const own = await createCollection(mine.auth, 'Mine');
      await createCollection(theirs.auth, 'Theirs');

      const response = await http()
        .get('/api/v1/collections')
        .set(...mine.auth);

      expect(response.status).toBe(200);
      expect((response.body as { id: string }[]).map((c) => c.id)).toEqual([own.id]);
      expect(response.headers['cache-control']).toBe('no-store');
    });

    it('gets one collection, and answers 404 to someone else’s exactly like to an unknown one', async () => {
      const owner = await account();
      const stranger = await account();
      const collection = await createCollection(owner.auth);

      const own = await http()
        .get(`/api/v1/collections/${collection.id}`)
        .set(...owner.auth);
      const foreign = await http()
        .get(`/api/v1/collections/${collection.id}`)
        .set(...stranger.auth);
      const unknown = await http()
        .get(`/api/v1/collections/${randomUUID()}`)
        .set(...stranger.auth);

      expect(own.status).toBe(200);
      expect(foreign.status).toBe(404);
      expect(unknown.status).toBe(404);
      const { message: foreignMessage } = foreign.body as { message: string };
      const { message: unknownMessage } = unknown.body as { message: string };
      expect(foreignMessage).toBe(unknownMessage);
    });

    it('answers 400 (not 500) to a malformed collection id', async () => {
      const { auth } = await account();

      const response = await http()
        .get('/api/v1/collections/not-a-uuid')
        .set(...auth);

      expect(response.status).toBe(400);
    });

    it('renames a collection, and refuses to rename someone else’s', async () => {
      const owner = await account();
      const stranger = await account();
      const collection = await createCollection(owner.auth, 'Before');

      const renamed = await http()
        .patch(`/api/v1/collections/${collection.id}`)
        .set(...owner.auth)
        .send({ name: 'After' });
      const refused = await http()
        .patch(`/api/v1/collections/${collection.id}`)
        .set(...stranger.auth)
        .send({ name: 'Stolen' });

      expect(renamed.status).toBe(200);
      expect(renamed.body).toMatchObject({ id: collection.id, name: 'After' });
      expect(refused.status).toBe(404);
    });

    it('deletes a collection with 204, audits collection.delete on it, and then answers 404', async () => {
      const owner = await account();
      const collection = await createCollection(owner.auth);

      const deleted = await http()
        .delete(`/api/v1/collections/${collection.id}`)
        .set(...owner.auth);
      const again = await http()
        .get(`/api/v1/collections/${collection.id}`)
        .set(...owner.auth);

      expect(deleted.status).toBe(204);
      expect(again.status).toBe(404);
      expect(collectionAudits()).toHaveLength(1);
      expect(collectionAudits()[0]).toMatchObject({
        action: 'collection.delete',
        targetType: 'collection',
        targetId: collection.id,
        userId: owner.id,
      });
    });

    it('audits a refused deletion as collection.delete.failed and leaves the collection alone', async () => {
      const owner = await account();
      const stranger = await account();
      const collection = await createCollection(owner.auth);

      const refused = await http()
        .delete(`/api/v1/collections/${collection.id}`)
        .set(...stranger.auth);
      const still = await http()
        .get(`/api/v1/collections/${collection.id}`)
        .set(...owner.auth);

      expect(refused.status).toBe(404);
      expect(still.status).toBe(200);
      expect(collectionAudits().map((entry) => entry.action)).toEqual(['collection.delete.failed']);
    });
  });

  describe('cards of a collection', () => {
    it('adds a card with 201, and adding it again gives a second entry', async () => {
      const { auth } = await account();
      const collection = await createCollection(auth);

      const first = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry({ variantId, gradingNote: 9.5, notes: 'Signed' }));
      const second = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry());

      expect(first.status).toBe(201);
      expect(first.body).toMatchObject({
        collectionId: collection.id,
        cardId,
        variantId,
        quantity: 2,
        condition: 'NM',
        language: 'fr',
        gradingNote: 9.5,
        notes: 'Signed',
      });
      expect(second.status).toBe(201);
      expect((first.body as { id: string }).id).not.toBe((second.body as { id: string }).id);
    });

    it.each([
      ['a quantity of 0', { quantity: 0 }],
      ['a fractional quantity', { quantity: 1.5 }],
      ['a quantity above 9999', { quantity: 10_000 }],
      ['an unknown condition', { condition: 'MINT' }],
      ['an unknown language', { language: 'jp' }],
      ['a grading note above 10', { gradingNote: 10.5 }],
      ['a grading note with two decimals', { gradingNote: 9.25 }],
      ['notes of 501 characters', { notes: 'a'.repeat(501) }],
      ['a malformed card id', { cardId: 'charizard' }],
      ['a malformed variant id', { variantId: 'holo' }],
      ['a field that does not exist', { collectionId: randomUUID() }],
    ])('answers 400 to %s', async (_label, override) => {
      const { auth } = await account();
      const collection = await createCollection(auth);

      const response = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry(override));

      expect(response.status).toBe(400);
    });

    it.each([
      ['a card that is not in the catalogue', { cardId: randomUUID() }],
      ['a card of another licence', { cardId: foreignCardId }],
      ['a printing of another card', { cardId: secondCardId, variantId }],
    ])('answers 404 to %s', async (_label, override) => {
      const { auth } = await account();
      const collection = await createCollection(auth);

      const response = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry(override));

      expect(response.status).toBe(404);
    });

    it('answers 404 when adding a card to someone else’s collection', async () => {
      const owner = await account();
      const stranger = await account();
      const collection = await createCollection(owner.auth);

      const response = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...stranger.auth)
        .send(validEntry());

      expect(response.status).toBe(404);
    });

    it('updates only the given fields, and clears notes with null', async () => {
      const { auth } = await account();
      const collection = await createCollection(auth);
      const added = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry({ notes: 'Keep?', gradingNote: 8 }));
      const { id: entryId } = added.body as { id: string };
      const url = `/api/v1/collections/${collection.id}/cards/${entryId}`;

      const quantity = await http()
        .patch(url)
        .set(...auth)
        .send({ quantity: 5 });
      const cleared = await http()
        .patch(url)
        .set(...auth)
        .send({ notes: null });

      expect(quantity.status).toBe(200);
      expect(quantity.body).toMatchObject({ quantity: 5, notes: 'Keep?', gradingNote: 8 });
      expect(cleared.body).toMatchObject({ quantity: 5, notes: null, gradingNote: 8 });
    });

    it.each([
      ['nothing to change', {}],
      ['the card', { cardId: randomUUID() }],
      ['a null quantity', { quantity: null }],
      ['an invalid condition', { condition: 'MINT' }],
    ])('answers 400 to an update with %s', async (_label, body) => {
      const { auth } = await account();
      const collection = await createCollection(auth);
      const added = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry());
      const { id: entryId } = added.body as { id: string };

      const response = await http()
        .patch(`/api/v1/collections/${collection.id}/cards/${entryId}`)
        .set(...auth)
        .send(body);

      expect(response.status).toBe(400);
    });

    it('answers 404 to an update of an unknown entry, or of an entry through another collection', async () => {
      const { auth } = await account();
      const collection = await createCollection(auth);
      const other = await createCollection(auth, 'Other');
      const added = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry());
      const { id: entryId } = added.body as { id: string };

      const unknown = await http()
        .patch(`/api/v1/collections/${collection.id}/cards/${randomUUID()}`)
        .set(...auth)
        .send({ quantity: 3 });
      const crossed = await http()
        .patch(`/api/v1/collections/${other.id}/cards/${entryId}`)
        .set(...auth)
        .send({ quantity: 3 });

      expect(unknown.status).toBe(404);
      expect(crossed.status).toBe(404);
    });

    it('removes an entry with 204, then answers 404', async () => {
      const { auth } = await account();
      const collection = await createCollection(auth);
      const added = await http()
        .post(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth)
        .send(validEntry());
      const { id: entryId } = added.body as { id: string };
      const url = `/api/v1/collections/${collection.id}/cards/${entryId}`;

      const removed = await http()
        .delete(url)
        .set(...auth);
      const again = await http()
        .delete(url)
        .set(...auth);

      expect(removed.status).toBe(204);
      expect(again.status).toBe(404);
    });

    it('lists the entries with their catalogue data, a page at a time, newest first', async () => {
      const { auth } = await account();
      const collection = await createCollection(auth);
      for (let i = 0; i < 3; i += 1) {
        await http()
          .post(`/api/v1/collections/${collection.id}/cards`)
          .set(...auth)
          .send(validEntry({ variantId: i === 0 ? variantId : undefined, quantity: i + 1 }));
      }

      const first = await http()
        .get(`/api/v1/collections/${collection.id}/cards?page=1&pageSize=2`)
        .set(...auth);
      const second = await http()
        .get(`/api/v1/collections/${collection.id}/cards?page=2&pageSize=2`)
        .set(...auth);

      expect(first.status).toBe(200);
      expect(first.headers['cache-control']).toBe('no-store');
      const firstBody = first.body as {
        items: { id: string; card: { nameFr: string }; set: { tcgdexId: string } }[];
        total: number;
        page: number;
        pageSize: number;
      };
      const secondBody = second.body as { items: { id: string }[]; total: number };
      expect(firstBody).toMatchObject({ total: 3, page: 1, pageSize: 2 });
      expect(firstBody.items).toHaveLength(2);
      expect(firstBody.items[0]).toMatchObject({
        card: { nameFr: 'Dracaufeu' },
        set: { tcgdexId: 'base1' },
      });
      expect(secondBody.items).toHaveLength(1);
      const ids = [...firstBody.items, ...secondBody.items].map((item) => item.id);
      expect(new Set(ids).size).toBe(3);
    });

    it('uses the default page when no query is given', async () => {
      const { auth } = await account();
      const collection = await createCollection(auth);

      const response = await http()
        .get(`/api/v1/collections/${collection.id}/cards`)
        .set(...auth);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ items: [], total: 0, page: 1, pageSize: 50 });
    });

    it.each([
      ['page 0', 'page=0'],
      ['a page size of 101', 'pageSize=101'],
      ['a page that is not a number', 'page=abc'],
      ['a page size with a decimal', 'pageSize=1.5'],
      ['a parameter that does not exist', 'sort=name'],
    ])('answers 400 to %s', async (_label, query) => {
      const { auth } = await account();
      const collection = await createCollection(auth);

      const response = await http()
        .get(`/api/v1/collections/${collection.id}/cards?${query}`)
        .set(...auth);

      expect(response.status).toBe(400);
    });

    it('answers 404 to the cards of someone else’s collection', async () => {
      const owner = await account();
      const stranger = await account();
      const collection = await createCollection(owner.auth);

      const response = await http()
        .get(`/api/v1/collections/${collection.id}/cards`)
        .set(...stranger.auth);

      expect(response.status).toBe(404);
    });
  });
});
