import type { Card } from '../../domain/entities/Card';
import type { CardNameSearch } from '../../domain/value-objects/CardNameSearch';

export const CARD_REPOSITORY = 'CARD_REPOSITORY';

/**
 * Read access to the card catalogue. There is deliberately no save(): the catalogue is written by
 * the TCG microservice (UPSERT on the unique keys of ADR-015) and by the seed, never by the
 * backend. Batch writing is the job of the dedicated Beta ticket.
 *
 * Every card comes with its set, the licence of the set and its printings, because an
 * autocomplete result needs the set name and a collection item needs the printing.
 */
export interface ICardRepository {
  /** An id that is not a UUID cannot exist: it gives null, not a database error. */
  findById(id: string): Promise<Card | null>;

  /** The cards of a set in printed order (2, 10, 100, TG01). Empty for an unknown set id. */
  findBySetId(setId: string): Promise<readonly Card[]>;

  /**
   * Cards whose name, in English or in French, contains the term, ignoring case but not accents
   * (no unaccent in the database yet: COLLR-418 chooses the search index). Sorted by English name
   * then TCGdex id so two identical searches give the same page.
   */
  searchByName(search: CardNameSearch): Promise<readonly Card[]>;
}
