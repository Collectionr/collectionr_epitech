import { randomUUID } from 'node:crypto';
import { AddCardEntryUseCase } from './AddCardEntryUseCase';
import type { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CardNotFoundError, CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

const USER_ID = randomUUID();
const CARD_ID = randomUUID();
const VARIANT_ID = randomUUID();

function buildCollection(userId = USER_ID): Collection {
  return Collection.create({ userId, licenceTCGId: randomUUID(), name: 'Ma collection' });
}

function validInput(collection: Collection) {
  return {
    userId: USER_ID,
    collectionId: collection.id,
    cardId: CARD_ID,
    quantity: 3,
    condition: 'NM',
    language: 'fr',
  };
}

describe('AddCardEntryUseCase', () => {
  const findById = jest.fn();
  const addCardEntry = jest.fn<Promise<CardEntry>, [CardEntry]>();
  let collection: Collection;

  function build(): AddCardEntryUseCase {
    return new AddCardEntryUseCase({ findById, addCardEntry } as unknown as ICollectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    collection = buildCollection();
    findById.mockResolvedValue(collection);
    addCardEntry.mockImplementation((entry: CardEntry) => Promise.resolve(entry));
  });

  it('adds an entry to the collection of its owner and hands it to the repository', async () => {
    const entry = await build().execute({
      ...validInput(collection),
      variantId: VARIANT_ID,
      gradingNote: 9,
      notes: ' signed ',
    });

    expect(entry.collectionId).toBe(collection.id);
    expect(entry.cardId).toBe(CARD_ID);
    expect(entry.variantId).toBe(VARIANT_ID);
    expect(entry.quantity).toBe(3);
    expect(entry.condition).toBe('NM');
    expect(entry.language).toBe('fr');
    expect(entry.gradingNote).toBe(9);
    expect(entry.notes).toBe('signed');
    expect(addCardEntry).toHaveBeenCalledWith(entry);
  });

  it('leaves the optional fields empty when they are not given', async () => {
    const entry = await build().execute(validInput(collection));

    expect(entry.variantId).toBeNull();
    expect(entry.gradingNote).toBeNull();
    expect(entry.notes).toBeNull();
  });

  it('adds a new entry on every call instead of merging identical ones', async () => {
    const first = await build().execute(validInput(collection));
    const second = await build().execute(validInput(collection));

    expect(second.id).not.toBe(first.id);
    expect(addCardEntry).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['quantity', { quantity: 0 }],
    ['condition', { condition: 'MINT' }],
    ['language', { language: 'jp' }],
    ['grading note', { gradingNote: 11 }],
    ['notes', { notes: 'x'.repeat(501) }],
    ['card id', { cardId: 'card-1' }],
    ['variant id', { variantId: '' }],
    ['collection id', { collectionId: 'collection-1' }],
  ])(
    'rejects an invalid %s as a validation error, without reading or writing anything',
    async (_label, override) => {
      await expect(build().execute({ ...validInput(collection), ...override })).rejects.toThrow(
        DomainValidationError,
      );
      expect(findById).not.toHaveBeenCalled();
      expect(addCardEntry).not.toHaveBeenCalled();
    },
  );

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute(validInput(collection))).rejects.toThrow(CollectionNotFoundError);
    expect(addCardEntry).not.toHaveBeenCalled();
  });

  it("refuses to add to another user's collection", async () => {
    findById.mockResolvedValue(buildCollection(randomUUID()));

    await expect(build().execute(validInput(collection))).rejects.toThrow(CollectionNotFoundError);
    expect(addCardEntry).not.toHaveBeenCalled();
  });

  it('propagates CardNotFoundError thrown by the repository (unknown card, variant or licence)', async () => {
    addCardEntry.mockRejectedValue(new CardNotFoundError());

    await expect(build().execute(validInput(collection))).rejects.toThrow(CardNotFoundError);
  });
});
