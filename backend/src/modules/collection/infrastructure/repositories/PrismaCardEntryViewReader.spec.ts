import { randomUUID } from 'node:crypto';
import { Prisma } from '../../../../generated/prisma/client.js';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PageRequest } from '../../domain/value-objects/PageRequest';
import { PrismaCardEntryViewReader } from './PrismaCardEntryViewReader';

const NOW = new Date('2026-11-06T10:00:00.000Z');

describe('PrismaCardEntryViewReader', () => {
  const count = jest.fn();
  const findMany = jest.fn();
  let batchOptions: unknown[] = [];
  let reader: PrismaCardEntryViewReader;

  beforeEach(() => {
    jest.resetAllMocks();
    batchOptions = [];
    const client = {
      cardEntry: { count, findMany },
      $transaction: (queries: unknown[], options?: unknown) => {
        batchOptions.push(options);
        return Promise.all(queries);
      },
    };
    reader = new PrismaCardEntryViewReader(client as unknown as PrismaClient);
  });

  const record = (variant: object | null) => ({
    id: randomUUID(),
    collectionId: randomUUID(),
    cardId: randomUUID(),
    variantId: variant === null ? null : randomUUID(),
    gradingResultId: null,
    quantity: 2,
    condition: 'NM',
    language: 'fr',
    gradingNote: new Prisma.Decimal('9.5'),
    notes: null,
    addedAt: NOW,
    updatedAt: NOW,
    card: {
      id: randomUUID(),
      number: '006',
      nameEn: 'Charizard',
      nameFr: 'Dracaufeu',
      category: 'Pokemon',
      rarity: 'Holo Rare',
      imageUrlEn: 'https://assets.tcgdex.net/en/base/base1/4',
      imageUrlFr: null,
      set: {
        id: randomUUID(),
        tcgdexId: 'base1',
        nameEn: 'Base Set',
        nameFr: null,
        abbreviationOfficial: null,
      },
    },
    variant,
  });

  it('reads the entries with their card, set and printing in one query, in the order of the index', async () => {
    const collectionId = randomUUID();
    const variant = {
      id: randomUUID(),
      type: 'holo',
      subtype: null,
      size: 'standard',
      stamps: ['1st-edition'],
      foil: null,
    };
    count.mockResolvedValue(61);
    findMany.mockResolvedValue([record(variant), record(null)]);

    const page = await reader.findCardEntryViews(
      collectionId,
      PageRequest.create({ page: 2, pageSize: 30 }),
    );

    expect(page).toMatchObject({ total: 61, page: 2, pageSize: 30 });
    expect(page.items).toHaveLength(2);
    expect(page.items[0].entry.gradingNote).toBe(9.5);
    expect(page.items[0].card).toMatchObject({ nameFr: 'Dracaufeu', number: '006' });
    expect(page.items[0].set).toMatchObject({ tcgdexId: 'base1', nameFr: null });
    expect(page.items[0].variant).toMatchObject({ type: 'holo', stamps: ['1st-edition'] });
    expect(page.items[1].variant).toBeNull();
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { collectionId },
        orderBy: [{ addedAt: 'desc' }, { id: 'desc' }],
        skip: 30,
        take: 30,
      }),
    );
  });

  it('does not expose the internal columns of the entry in the card, set and printing views', async () => {
    count.mockResolvedValue(1);
    findMany.mockResolvedValue([record(null)]);

    const page = await reader.findCardEntryViews(randomUUID(), PageRequest.create());

    expect(Object.keys(page.items[0].card).sort()).toEqual([
      'category',
      'id',
      'imageUrlEn',
      'imageUrlFr',
      'nameEn',
      'nameFr',
      'number',
      'rarity',
    ]);
  });

  it('reads the total and the page in one snapshot (REPEATABLE READ), never two different states', async () => {
    count.mockResolvedValue(0);
    findMany.mockResolvedValue([]);

    await reader.findCardEntryViews(randomUUID(), PageRequest.create());

    expect(batchOptions).toEqual([{ isolationLevel: 'RepeatableRead' }]);
  });

  it('answers an empty page, without any query, for a malformed collection id', async () => {
    const page = await reader.findCardEntryViews('not-a-uuid', PageRequest.create());

    expect(page).toEqual({ items: [], total: 0, page: 1, pageSize: 50 });
    expect(findMany).not.toHaveBeenCalled();
  });
});
