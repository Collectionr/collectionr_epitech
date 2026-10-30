import { UpdateCardEntryUseCase } from './UpdateCardEntryUseCase';
import { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CardEntryNotFoundError, CollectionNotFoundError } from '../errors/CollectionErrors';
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

function buildEntry(): CardEntry {
  return CardEntry.restore({
    id: 'entry-1',
    collectionId: 'collection-1',
    cardId: 'card-1',
    variantId: 'variant-1',
    quantity: 2,
    condition: 'NM',
    language: 'fr',
    gradingNote: null,
    notes: null,
    addedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

const baseInput = { userId: 'user-1', collectionId: 'collection-1', entryId: 'entry-1' };

describe('UpdateCardEntryUseCase', () => {
  const findById = jest.fn();
  const findCardEntryById = jest.fn();
  const saveCardEntry = jest.fn<Promise<CardEntry>, [CardEntry]>();

  function build(): UpdateCardEntryUseCase {
    const collectionRepository = {
      findById,
      findCardEntryById,
      saveCardEntry,
    } as unknown as ICollectionRepository;
    return new UpdateCardEntryUseCase(collectionRepository);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    findById.mockResolvedValue(buildCollection());
    findCardEntryById.mockResolvedValue(buildEntry());
    saveCardEntry.mockImplementation((entry: CardEntry) => Promise.resolve(entry));
  });

  it('updates the entry and saves it', async () => {
    const updated = await build().execute({
      ...baseInput,
      changes: { quantity: 5, condition: 'LP', notes: 'resleeved' },
    });

    expect(updated.quantity).toBe(5);
    expect(updated.condition).toBe('LP');
    expect(updated.notes).toBe('resleeved');
    expect(updated.cardId).toBe('card-1');
    expect(updated.variantId).toBe('variant-1');
    expect(saveCardEntry).toHaveBeenCalledWith(updated);
  });

  it('looks the entry up inside the verified collection only', async () => {
    await build().execute({ ...baseInput, changes: { quantity: 5 } });

    expect(findCardEntryById).toHaveBeenCalledWith('collection-1', 'entry-1');
  });

  it('rejects invalid changes without saving anything', async () => {
    await expect(build().execute({ ...baseInput, changes: { quantity: 0 } })).rejects.toThrow(
      DomainValidationError,
    );
    expect(saveCardEntry).not.toHaveBeenCalled();
  });

  it('rejects when the entry does not exist in the collection', async () => {
    findCardEntryById.mockResolvedValue(null);

    await expect(build().execute({ ...baseInput, changes: { quantity: 5 } })).rejects.toThrow(
      CardEntryNotFoundError,
    );
    expect(saveCardEntry).not.toHaveBeenCalled();
  });

  it('rejects when the collection does not exist, without looking for the entry', async () => {
    findById.mockResolvedValue(null);

    await expect(build().execute({ ...baseInput, changes: { quantity: 5 } })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(findCardEntryById).not.toHaveBeenCalled();
  });

  it("refuses to update an entry of another user's collection", async () => {
    findById.mockResolvedValue(buildCollection('someone-else'));

    await expect(build().execute({ ...baseInput, changes: { quantity: 5 } })).rejects.toThrow(
      CollectionNotFoundError,
    );
    expect(findCardEntryById).not.toHaveBeenCalled();
    expect(saveCardEntry).not.toHaveBeenCalled();
  });
});
