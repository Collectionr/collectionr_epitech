import type { Prisma } from '../../../../generated/prisma/client.js';

/**
 * Order of every read of a collection's entries: most recent first, ties broken on the id so that
 * pages are stable. It is the order of the index on (collectionId, addedAt DESC, id DESC): the
 * repository and the catalogue-joined read model must share it, or a page of one would not match
 * a page of the other.
 */
export const CARD_ENTRY_ORDER: Prisma.CardEntryOrderByWithRelationInput[] = [
  { addedAt: 'desc' },
  { id: 'desc' },
];
