import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../../auth/interface/guards/JwtAuthGuard';
import {
  CardEntryNotFoundError,
  CollectionLimitReachedError,
  CollectionNotFoundError,
} from '../../application/errors/CollectionErrors';
import type { AddCardEntryUseCase } from '../../application/use-cases/AddCardEntryUseCase';
import type { CreateCollectionUseCase } from '../../application/use-cases/CreateCollectionUseCase';
import type { DeleteCollectionUseCase } from '../../application/use-cases/DeleteCollectionUseCase';
import type { GetCollectionUseCase } from '../../application/use-cases/GetCollectionUseCase';
import type { ListCollectionCardsUseCase } from '../../application/use-cases/ListCollectionCardsUseCase';
import type { ListCollectionsUseCase } from '../../application/use-cases/ListCollectionsUseCase';
import type { RemoveCardEntryUseCase } from '../../application/use-cases/RemoveCardEntryUseCase';
import type { UpdateCardEntryUseCase } from '../../application/use-cases/UpdateCardEntryUseCase';
import type { UpdateCollectionUseCase } from '../../application/use-cases/UpdateCollectionUseCase';
import { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';
import { DomainValidationError } from '../../domain/errors/DomainValidationError';
import { CollectionsController } from './CollectionsController';

const USER: AuthenticatedUser = { id: randomUUID() };
const LICENCE_ID = randomUUID();

describe('CollectionsController', () => {
  const create = jest.fn();
  const list = jest.fn();
  const get = jest.fn();
  const update = jest.fn();
  const remove = jest.fn();
  const listCards = jest.fn();
  const addCard = jest.fn();
  const updateCard = jest.fn();
  const removeCard = jest.fn();
  let controller: CollectionsController;

  const collection = Collection.create({
    userId: USER.id,
    licenceTCGId: LICENCE_ID,
    name: 'Ma collection',
  });
  const entry = CardEntry.create({
    collectionId: collection.id,
    cardId: randomUUID(),
    quantity: 1,
    condition: 'NM',
    language: 'fr',
  });

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new CollectionsController(
      { execute: create } as unknown as CreateCollectionUseCase,
      { execute: list } as unknown as ListCollectionsUseCase,
      { execute: get } as unknown as GetCollectionUseCase,
      { execute: update } as unknown as UpdateCollectionUseCase,
      { execute: remove } as unknown as DeleteCollectionUseCase,
      { execute: listCards } as unknown as ListCollectionCardsUseCase,
      { execute: addCard } as unknown as AddCardEntryUseCase,
      { execute: updateCard } as unknown as UpdateCardEntryUseCase,
      { execute: removeCard } as unknown as RemoveCardEntryUseCase,
    );
  });

  describe('collections', () => {
    it('creates a collection for the authenticated user, whatever the body says', async () => {
      create.mockResolvedValue(collection);

      const response = await controller.create(USER, { licenceTCGId: LICENCE_ID, name: 'Ma' });

      expect(create).toHaveBeenCalledWith({
        userId: USER.id,
        licenceTCGId: LICENCE_ID,
        name: 'Ma',
      });
      expect(response.id).toBe(collection.id);
    });

    it('lists the collections of the authenticated user', async () => {
      list.mockResolvedValue([collection]);

      const response = await controller.list(USER);

      expect(list).toHaveBeenCalledWith({ userId: USER.id });
      expect(response.map((c) => c.id)).toEqual([collection.id]);
    });

    it('gets, renames and deletes on behalf of the authenticated user', async () => {
      get.mockResolvedValue(collection);
      update.mockResolvedValue(collection.rename('Doubles'));
      remove.mockResolvedValue(undefined);

      await controller.get(USER, collection.id);
      const renamed = await controller.rename(USER, collection.id, { name: 'Doubles' });
      await controller.remove(USER, collection.id);

      expect(get).toHaveBeenCalledWith({ userId: USER.id, collectionId: collection.id });
      expect(update).toHaveBeenCalledWith({
        userId: USER.id,
        collectionId: collection.id,
        name: 'Doubles',
      });
      expect(renamed.name).toBe('Doubles');
      expect(remove).toHaveBeenCalledWith({ userId: USER.id, collectionId: collection.id });
    });

    it.each([
      ['a validation error to 400', new DomainValidationError('bad'), BadRequestException],
      ['a missing collection to 404', new CollectionNotFoundError(), NotFoundException],
      ['the limit to 409', new CollectionLimitReachedError(), ConflictException],
    ])('turns %s', async (_label, error, expected) => {
      create.mockRejectedValue(error);

      await expect(
        controller.create(USER, { licenceTCGId: LICENCE_ID, name: 'Ma' }),
      ).rejects.toBeInstanceOf(expected);
    });

    it('lets an unexpected error through, to become a generic 500', async () => {
      const failure = new Error('connection lost');
      get.mockRejectedValue(failure);

      await expect(controller.get(USER, collection.id)).rejects.toBe(failure);
    });
  });

  describe('cards', () => {
    it('lists a page of the cards of a collection', async () => {
      listCards.mockResolvedValue({ items: [], total: 0, page: 2, pageSize: 10 });

      const response = await controller.listCards(USER, collection.id, { page: 2, pageSize: 10 });

      expect(listCards).toHaveBeenCalledWith({
        userId: USER.id,
        collectionId: collection.id,
        page: 2,
        pageSize: 10,
      });
      expect(response).toMatchObject({ items: [], total: 0, page: 2, pageSize: 10 });
    });

    it('adds a card with every field of the body', async () => {
      addCard.mockResolvedValue(entry);
      const variantId = randomUUID();

      const response = await controller.addCard(USER, collection.id, {
        cardId: entry.cardId,
        variantId,
        quantity: 2,
        condition: 'LP',
        language: 'en',
        gradingNote: 9,
        notes: 'Signed',
      });

      expect(addCard).toHaveBeenCalledWith({
        userId: USER.id,
        collectionId: collection.id,
        cardId: entry.cardId,
        variantId,
        quantity: 2,
        condition: 'LP',
        language: 'en',
        gradingNote: 9,
        notes: 'Signed',
      });
      expect(response.id).toBe(entry.id);
    });

    it('updates an entry with the fields of the body only', async () => {
      updateCard.mockResolvedValue(entry);

      await controller.updateCard(USER, collection.id, entry.id, { notes: null });

      expect(updateCard).toHaveBeenCalledWith({
        userId: USER.id,
        collectionId: collection.id,
        entryId: entry.id,
        changes: {
          quantity: undefined,
          condition: undefined,
          language: undefined,
          gradingNote: undefined,
          notes: null,
        },
      });
    });

    it('removes an entry', async () => {
      removeCard.mockResolvedValue(undefined);

      await controller.removeCard(USER, collection.id, entry.id);

      expect(removeCard).toHaveBeenCalledWith({
        userId: USER.id,
        collectionId: collection.id,
        entryId: entry.id,
      });
    });

    it('turns a missing entry into 404', async () => {
      removeCard.mockRejectedValue(new CardEntryNotFoundError());

      await expect(controller.removeCard(USER, collection.id, entry.id)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
