import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '../../../../generated/prisma/client.js';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import {
  CardEntryNotFoundError,
  CardNotFoundError,
  CollectionLimitReachedError,
  CollectionNotFoundError,
  LicenceNotFoundError,
} from '../../application/errors/CollectionErrors';
import type { ICollectionRepository } from '../../application/ports/ICollectionRepository';
import type { Page } from '../../application/ports/Page';
import type { CardEntry, ValidCardEntryChanges } from '../../domain/entities/CardEntry';
import type { Collection } from '../../domain/entities/Collection';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import { CARD_ENTRY_ORDER } from './CardEntryOrder';
import { toCardEntry, toCollection } from './CollectionMapper';
import {
  COLLECTION_LICENCE_FK,
  ENTRY_CARD_FK,
  ENTRY_COLLECTION_FK,
  ENTRY_VARIANT_FK,
  isForeignKeyViolationOn,
  isRecordNotFound,
} from './ForeignKeyViolation';

/**
 * PostgreSQL implementation of ICollectionRepository (COLLR-417, ADR-017). Every guarantee the
 * port states is held by the store (a row lock, foreign keys, one statement or one transaction),
 * not by a read followed by a write in application code, which two concurrent requests would both
 * pass. The behavioural contract (src/contracts/CollectionPorts.contract.ts) runs against it on a
 * real database.
 */
@Injectable()
export class PrismaCollectionRepository implements ICollectionRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async create(collection: Collection, maxPerUser: number): Promise<Collection> {
    try {
      const record = await this.prismaClient.$transaction(async (tx) => {
        // The lock on the owner serialises every creation of that owner's collections: the second
        // one waits here, then counts what the first one committed. NO KEY UPDATE conflicts with
        // itself (which is what is needed) but not with the key-share locks that inserts into
        // tables referencing users take, so it does not block sessions and the like.
        await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${collection.userId}::uuid FOR NO KEY UPDATE`;

        const licence = await tx.licenceTCG.findUnique({
          where: { id: collection.licenceTCGId },
          select: { id: true },
        });
        if (licence === null) {
          throw new LicenceNotFoundError();
        }
        const owned = await tx.collection.count({ where: { userId: collection.userId } });
        if (owned >= maxPerUser) {
          throw new CollectionLimitReachedError();
        }

        return tx.collection.create({
          data: {
            id: collection.id,
            userId: collection.userId,
            licenceTCGId: collection.licenceTCGId,
            name: collection.name,
            createdAt: collection.createdAt,
            updatedAt: collection.updatedAt,
          } satisfies Prisma.CollectionUncheckedCreateInput,
        });
      });
      return toCollection(record);
    } catch (error) {
      if (isForeignKeyViolationOn(error, COLLECTION_LICENCE_FK)) {
        throw new LicenceNotFoundError();
      }
      throw error;
    }
  }

  async findById(id: string): Promise<Collection | null> {
    // PostgreSQL rejects a malformed UUID with an error: such an id simply cannot exist.
    if (!isUuid(id)) {
      return null;
    }
    const record = await this.prismaClient.collection.findUnique({ where: { id } });
    return record === null ? null : toCollection(record);
  }

  async findByUserId(userId: string): Promise<readonly Collection[]> {
    if (!isUuid(userId)) {
      return [];
    }
    const records = await this.prismaClient.collection.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    return records.map(toCollection);
  }

  async rename(collection: Collection): Promise<Collection> {
    try {
      // `update` never inserts: a collection deleted in the meantime is reported, not brought back.
      const record = await this.prismaClient.collection.update({
        where: { id: collection.id },
        data: { name: collection.name, updatedAt: collection.updatedAt },
      });
      return toCollection(record);
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new CollectionNotFoundError();
      }
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    if (!isUuid(id)) {
      return;
    }
    // One statement: the entries go with it through ON DELETE CASCADE, in the same atomic step.
    // `deleteMany` (not `delete`) so that a collection already gone is not an error.
    await this.prismaClient.collection.deleteMany({ where: { id } });
  }

  async addCardEntry(entry: CardEntry): Promise<CardEntry> {
    try {
      const record = await this.prismaClient.$transaction(async (tx) => {
        // FOR SHARE: the collection cannot be deleted until this entry is committed (a delete
        // waits for the lock, then removes the entry along with the collection).
        const collections = await tx.$queryRaw<{ licenceTCGId: string }[]>`
          SELECT "licenceTCGId" FROM "collections" WHERE "id" = ${entry.collectionId}::uuid FOR SHARE`;
        const collection = collections[0];
        if (collection === undefined) {
          throw new CollectionNotFoundError();
        }

        // A foreign key only proves that the card exists. That it is from the licence of the
        // collection cannot be a constraint, so it is checked here, in the same transaction.
        const card = await tx.card.findUnique({
          where: { id: entry.cardId },
          select: { set: { select: { licenceTCGId: true } } },
        });
        if (card === null || card.set.licenceTCGId !== collection.licenceTCGId) {
          throw new CardNotFoundError();
        }
        // The composite foreign key (cardId, variantId) is the guarantee; this check only turns
        // its failure into the typed error without waiting for the insert to fail.
        if (entry.variantId !== null) {
          const variant = await tx.variant.findFirst({
            where: { id: entry.variantId, cardId: entry.cardId },
            select: { id: true },
          });
          if (variant === null) {
            throw new CardNotFoundError();
          }
        }

        return tx.cardEntry.create({
          data: {
            id: entry.id,
            collectionId: entry.collectionId,
            cardId: entry.cardId,
            variantId: entry.variantId,
            quantity: entry.quantity,
            condition: entry.condition,
            language: entry.language,
            gradingNote: entry.gradingNote,
            notes: entry.notes,
            addedAt: entry.addedAt,
            updatedAt: entry.updatedAt,
          } satisfies Prisma.CardEntryUncheckedCreateInput,
        });
      });
      return toCardEntry(record);
    } catch (error) {
      if (isForeignKeyViolationOn(error, ENTRY_COLLECTION_FK)) {
        throw new CollectionNotFoundError();
      }
      if (
        isForeignKeyViolationOn(error, ENTRY_CARD_FK) ||
        isForeignKeyViolationOn(error, ENTRY_VARIANT_FK)
      ) {
        throw new CardNotFoundError();
      }
      throw error;
    }
  }

  async updateCardEntry(
    collectionId: string,
    entryId: string,
    changes: ValidCardEntryChanges,
  ): Promise<CardEntry> {
    if (!isUuid(collectionId) || !isUuid(entryId)) {
      throw new CardEntryNotFoundError();
    }

    // Only the given fields are written: a column that is not in `data` is not in the UPDATE, so a
    // concurrent edit of another field survives, and so does `gradingResultId`.
    const data: Prisma.CardEntryUncheckedUpdateInput = { updatedAt: new Date() };
    if (changes.quantity !== undefined) {
      data.quantity = changes.quantity;
    }
    if (changes.condition !== undefined) {
      data.condition = changes.condition;
    }
    if (changes.language !== undefined) {
      data.language = changes.language;
    }
    if (changes.gradingNote !== undefined) {
      data.gradingNote = changes.gradingNote;
    }
    if (changes.notes !== undefined) {
      data.notes = changes.notes;
    }

    try {
      // Scoped by the collection too: an entry is never reachable through another collection.
      // `update` never inserts, so an entry deleted in the meantime does not come back.
      const record = await this.prismaClient.cardEntry.update({
        where: { id: entryId, collectionId },
        data,
      });
      return toCardEntry(record);
    } catch (error) {
      if (isRecordNotFound(error)) {
        throw new CardEntryNotFoundError();
      }
      throw error;
    }
  }

  async findCardEntries(collectionId: string, page: PageRequest): Promise<Page<CardEntry>> {
    if (!isUuid(collectionId)) {
      return { items: [], total: 0, page: page.page, pageSize: page.pageSize };
    }

    const [total, records] = await this.prismaClient.$transaction([
      this.prismaClient.cardEntry.count({ where: { collectionId } }),
      this.prismaClient.cardEntry.findMany({
        where: { collectionId },
        orderBy: CARD_ENTRY_ORDER,
        skip: page.offset,
        take: page.pageSize,
      }),
    ]);

    return {
      items: records.map(toCardEntry),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }

  async deleteCardEntry(collectionId: string, entryId: string): Promise<void> {
    if (!isUuid(collectionId) || !isUuid(entryId)) {
      throw new CardEntryNotFoundError();
    }
    const { count } = await this.prismaClient.cardEntry.deleteMany({
      where: { id: entryId, collectionId },
    });
    if (count === 0) {
      throw new CardEntryNotFoundError();
    }
  }
}
