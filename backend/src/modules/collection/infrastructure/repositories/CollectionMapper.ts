import type {
  CardEntry as PrismaCardEntry,
  Collection as PrismaCollection,
} from '../../../../generated/prisma/client.js';
import { CardEntry } from '../../domain/entities/CardEntry';
import { Collection } from '../../domain/entities/Collection';

/** Rebuilds the domain collection from a stored row (no re-validation, see Collection.restore). */
export function toCollection(record: PrismaCollection): Collection {
  return Collection.restore({
    id: record.id,
    userId: record.userId,
    licenceTCGId: record.licenceTCGId,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}

/**
 * Rebuilds the domain entry from a stored row. `gradingResultId` is not read: the domain does not
 * model it (it belongs to the grading epic) and the repository never writes it.
 */
export function toCardEntry(record: PrismaCardEntry): CardEntry {
  return CardEntry.restore({
    id: record.id,
    collectionId: record.collectionId,
    cardId: record.cardId,
    variantId: record.variantId,
    quantity: record.quantity,
    condition: record.condition,
    language: record.language,
    // decimal(3,1) holds exactly one decimal, so the conversion to a number is exact.
    gradingNote: record.gradingNote === null ? null : record.gradingNote.toNumber(),
    notes: record.notes,
    addedAt: record.addedAt,
    updatedAt: record.updatedAt,
  });
}
