// Fixed business limits of the collection domain. None of them is set by the CDC (§3.1.3 only
// names the fields): they are product decisions to be validated by the PO, kept in one place so
// that changing one is a one-line edit.

export const COLLECTION_NAME_MIN_LENGTH = 1;
export const COLLECTION_NAME_MAX_LENGTH = 60;

/** Collections one user can own, whatever their licence. Enforced by CreateCollectionUseCase. */
export const MAX_COLLECTIONS_PER_USER = 10;

/** Copies of the same printing held in one entry. */
export const CARD_ENTRY_MIN_QUANTITY = 1;
export const CARD_ENTRY_MAX_QUANTITY = 9999;

/** Free text the collector attaches to an entry (CDC §3.1.4, "notes optionnelles"). */
export const CARD_ENTRY_NOTES_MAX_LENGTH = 500;

/** Grading note scale: the AI pre-grading and the PSA/BGS/CGC grades all go from 0 to 10 (CDC §3.4.2). */
export const GRADING_NOTE_MIN = 0;
export const GRADING_NOTE_MAX = 10;

// Lists are paginated on the API side (CDC §3.1.3: collections of up to 10 000 entries).
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;
/** Keeps `(page - 1) * pageSize` far below Number.MAX_SAFE_INTEGER and any database integer. */
export const MAX_PAGE = 100_000;
