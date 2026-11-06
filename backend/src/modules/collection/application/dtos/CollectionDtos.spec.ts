import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import type { CardEntryView } from '../ports/ICardEntryViewReader';
import {
  AddCardEntryDto,
  CreateCollectionDto,
  ListCardsQueryDto,
  UpdateCardEntryDto,
  UpdateCollectionDto,
} from './CollectionRequestDtos';
import {
  CardEntryResponseDto,
  CollectionCardsPageResponseDto,
  CollectionResponseDto,
} from './CollectionResponseDtos';

type Constructor<T> = new () => T;

async function propertiesInError<T extends object>(
  type: Constructor<T>,
  payload: Record<string, unknown>,
): Promise<string[]> {
  const errors = await validate(plainToInstance(type, payload));
  return errors.map((error) => error.property);
}

const CARD_ID = randomUUID();
const validEntry = { cardId: CARD_ID, quantity: 2, condition: 'NM', language: 'fr' };

describe('CreateCollectionDto / UpdateCollectionDto', () => {
  it('accepts a licence id and a name', async () => {
    await expect(
      propertiesInError(CreateCollectionDto, { licenceTCGId: randomUUID(), name: 'Ma collection' }),
    ).resolves.toEqual([]);
    await expect(propertiesInError(UpdateCollectionDto, { name: 'Doubles' })).resolves.toEqual([]);
  });

  it('refuses a licence that is not a UUID, and a missing, empty or oversized name', async () => {
    await expect(
      propertiesInError(CreateCollectionDto, { licenceTCGId: 'pokemon', name: 'Ok' }),
    ).resolves.toEqual(['licenceTCGId']);
    await expect(propertiesInError(UpdateCollectionDto, {})).resolves.toContain('name');
    await expect(propertiesInError(UpdateCollectionDto, { name: '' })).resolves.toContain('name');
    await expect(
      propertiesInError(UpdateCollectionDto, { name: 'a'.repeat(900_000) }),
    ).resolves.toContain('name');
  });
});

describe('AddCardEntryDto', () => {
  it('accepts the required fields alone, and with every optional one', async () => {
    await expect(propertiesInError(AddCardEntryDto, validEntry)).resolves.toEqual([]);
    await expect(
      propertiesInError(AddCardEntryDto, {
        ...validEntry,
        variantId: randomUUID(),
        gradingNote: 9.5,
        notes: 'Signed',
      }),
    ).resolves.toEqual([]);
    await expect(
      propertiesInError(AddCardEntryDto, {
        ...validEntry,
        variantId: null,
        gradingNote: null,
        notes: null,
      }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['cardId', { cardId: 'x' }],
    ['variantId', { variantId: 'x' }],
    ['quantity', { quantity: '2' }],
    ['quantity', { quantity: 1.5 }],
    ['condition', { condition: 3 }],
    ['language', { language: undefined }],
    ['gradingNote', { gradingNote: '9' }],
    ['gradingNote', { gradingNote: Number.NaN }],
    ['notes', { notes: 'a'.repeat(900_000) }],
  ])('refuses a wrong %s', async (property, override) => {
    await expect(
      propertiesInError(AddCardEntryDto, { ...validEntry, ...override }),
    ).resolves.toContain(property);
  });
});

describe('UpdateCardEntryDto', () => {
  it('accepts any subset of the editable fields, and null to clear a grade or notes', async () => {
    await expect(propertiesInError(UpdateCardEntryDto, {})).resolves.toEqual([]);
    await expect(propertiesInError(UpdateCardEntryDto, { quantity: 3 })).resolves.toEqual([]);
    await expect(
      propertiesInError(UpdateCardEntryDto, { gradingNote: null, notes: null }),
    ).resolves.toEqual([]);
  });

  it.each([
    ['quantity', { quantity: null }],
    ['quantity', { quantity: '3' }],
    ['condition', { condition: null }],
    ['language', { language: 4 }],
    ['gradingNote', { gradingNote: 'A' }],
    ['notes', { notes: 5 }],
  ])(
    'refuses a wrong %s (null is only a way to clear a grade or notes)',
    async (property, body) => {
      await expect(propertiesInError(UpdateCardEntryDto, body)).resolves.toContain(property);
    },
  );
});

describe('ListCardsQueryDto', () => {
  it('reads numbers from the query string, which arrives as text', async () => {
    const query = plainToInstance(ListCardsQueryDto, { page: '2', pageSize: '25' });

    expect(query).toMatchObject({ page: 2, pageSize: 25 });
    await expect(validate(query)).resolves.toEqual([]);
  });

  it('accepts no parameter at all, and refuses text or decimals', async () => {
    await expect(propertiesInError(ListCardsQueryDto, {})).resolves.toEqual([]);
    await expect(propertiesInError(ListCardsQueryDto, { page: 'abc' })).resolves.toEqual(['page']);
    await expect(propertiesInError(ListCardsQueryDto, { pageSize: '1.5' })).resolves.toEqual([
      'pageSize',
    ]);
  });
});

describe('response DTOs', () => {
  const collection = Collection.create({
    userId: randomUUID(),
    licenceTCGId: randomUUID(),
    name: 'Ma collection',
  });
  const entry = CardEntry.create({
    collectionId: collection.id,
    cardId: CARD_ID,
    quantity: 2,
    condition: 'NM',
    language: 'fr',
    gradingNote: 9.5,
    notes: 'Signed',
  });

  it('exposes a collection field by field, without its owner', () => {
    const dto = CollectionResponseDto.fromCollection(collection);

    expect(dto).toEqual({
      id: collection.id,
      licenceTCGId: collection.licenceTCGId,
      name: 'Ma collection',
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
    });
    expect(dto).not.toHaveProperty('userId');
  });

  it('exposes an entry with ISO dates', () => {
    expect(CardEntryResponseDto.fromEntry(entry)).toEqual({
      id: entry.id,
      collectionId: collection.id,
      cardId: CARD_ID,
      variantId: null,
      quantity: 2,
      condition: 'NM',
      language: 'fr',
      gradingNote: 9.5,
      notes: 'Signed',
      addedAt: entry.addedAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    });
  });

  it('exposes a page of entries with their card, set and printing', () => {
    const variantId = randomUUID();
    const withVariant: CardEntryView = {
      entry,
      card: {
        id: CARD_ID,
        number: '006',
        nameEn: 'Charizard',
        nameFr: 'Dracaufeu',
        category: 'Pokemon',
        rarity: null,
        imageUrlEn: null,
        imageUrlFr: null,
      },
      set: {
        id: randomUUID(),
        tcgdexId: 'base1',
        nameEn: 'Base Set',
        nameFr: null,
        abbreviationOfficial: null,
      },
      variant: {
        id: variantId,
        type: 'holo',
        subtype: null,
        size: 'standard',
        stamps: ['1st-edition'],
        foil: null,
      },
    };

    const dto = CollectionCardsPageResponseDto.fromPage({
      items: [withVariant, { ...withVariant, variant: null }],
      total: 2,
      page: 1,
      pageSize: 50,
    });

    expect(dto).toMatchObject({ total: 2, page: 1, pageSize: 50 });
    expect(dto.items[0]).toMatchObject({
      id: entry.id,
      quantity: 2,
      card: { nameFr: 'Dracaufeu' },
      set: { tcgdexId: 'base1' },
      variant: { id: variantId, stamps: ['1st-edition'] },
    });
    expect(dto.items[1].variant).toBeNull();
  });
});
