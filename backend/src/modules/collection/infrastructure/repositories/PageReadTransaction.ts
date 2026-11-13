/**
 * Options of the transaction that reads a page: the total and the items must come from the same
 * snapshot. In PostgreSQL's default isolation (READ COMMITTED) each statement sees its own state,
 * so an entry committed between the count and the page gave `total: 0` with an item in `items`.
 * REPEATABLE READ takes one snapshot for the whole transaction; it only reads, so it cannot fail
 * with a serialization error.
 */
export const PAGE_READ_TRANSACTION_OPTIONS = { isolationLevel: 'RepeatableRead' } as const;
