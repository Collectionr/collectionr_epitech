import { AddCardEntryUseCase } from './AddCardEntryUseCase';
import type { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CardNotFoundError, CollectionNotFoundError } from '../errors/CollectionErrors';
import type { ICollectionRepository } from '../ports/ICollectionRepository';

function buildCollection(userId = 'user-1'): Collection {
  return Collection.restore({
    id: 'collection-1',
    userId,
    licenceTCGId: 'licence-1',
    name: 'Ma collection',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

const validInput = {
  userId: 'user-1',
  collectionId: 'collection-1',
  cardId: 'card-1',
  quantity: 3,
  condition: 'NM',
  language: 'fr',
};

describe('AddCardEntryUseCase', () => {
  const findById = jest.fn();
  const saveCardEntry = jest.fn<Promise<CardEntry>, [CardEntry]>();

  function build(): AddCardEntryUseCase {
    const collectionRepository = { findById, saveCardEntry } as unknown as ICollectionRepository;
    return new AddCardEntryUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildCollection());
    saveCardEntry.mockImplementation((entry: CardEntry) => Promise.resolve(entry));
  });

  it('adds an entry to the collection of its owner and saves it', async () => {
    const entry = await build().execute({
      ...validInput,
      variantId: 'variant-1',
      gradingNote: 9,
      notes: ' signed ',
    });

    expect(entry.collectionId).toBe('collection-1');
    expect(entry.cardId).toBe('card-1');
    expect(entry.variantId).toBe('variant-1');
    expect(entry.quantity).toBe(3);
    expect(entry.condition).toBe('NM');
    expect(entry.language).toBe('fr');
    expect(entry.gradingNote).toBe(9);
    expect(entry.notes).toBe('signed');
    expect(saveCardEntry).toHaveBeenCalledWith(entry);
  });

  it('leaves the optional fields empty when they are not given', async () => {
    const entry = await build().execute(validInput);

    expect(entry.variantId).toBeNull();
    expect(entry.gradingNote).toBeNull();
    expect(entry.notes).toBeNull();
  });

  it('adds a new entry on every call instead of merging identical ones', async () => {
    const first = await build().execute(validInput);
    const second = await build().execute(validInput);

    expect(second.id).not.toBe(first.id);
    expect(saveCardEntry).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['quantity', { quantity: 0 }],
    ['condition', { condition: 'MINT' }],
    ['language', { language: 'jp' }],
    ['grading note', { gradingNote: 11 }],
    ['notes', { notes: 'x'.repeat(501) }],
  ])('rejects an invalid %s without reading or saving anything', async (_label, override) => {
    await expect(build().execute({ ...validInput, ...override })).rejects.toThrow(
      DomainValidationError,
    );
    expect(findById).not.toHaveBeenCalled();
    expect(saveCardEntry).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute(validInput)).rejects.toThrow(CollectionNotFoundError);
    expect(saveCardEntry).not.toHaveBeenCalled();
  });

  it("refuses to add to another user's collection", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    await expect(build().execute(validInput)).rejects.toThrow(CollectionNotFoundError);
    expect(saveCardEntry).not.toHaveBeenCalled();
  });

  it('propagates CardNotFoundError thrown by saveCardEntry() (unknown card or variant)', async () => {
    saveCardEntry.mockRejectedValue(new CardNotFoundError());

    await expect(build().execute(validInput)).rejects.toThrow(CardNotFoundError);
  });
});
