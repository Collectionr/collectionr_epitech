import { InvalidCardSearchError } from '../errors/InvalidCardSearchError';

export const MIN_SEARCH_TERM_LENGTH = 2;
export const MAX_SEARCH_TERM_LENGTH = 100;
export const DEFAULT_SEARCH_LIMIT = 20;
export const MAX_SEARCH_LIMIT = 50;

// Control, format (zero-width, bidi overrides) and line/paragraph separators: nobody types them
// in a card name, and they make two searches look the same while matching different rows.
const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export interface CardNameSearchProps {
  readonly term: string;
  readonly limit?: number;
}

/**
 * What a user typed in the catalogue search box: a piece of a card name (any language) and how
 * many cards to bring back. Built here so that every caller (autocomplete today, other searches
 * later) is refused the same way before a query reaches the database.
 */
export class CardNameSearch {
  private constructor(
    public readonly term: string,
    public readonly limit: number,
  ) {}

  static create(props: CardNameSearchProps): CardNameSearch {
    const term = props.term.trim().normalize('NFC');
    if (term.length < MIN_SEARCH_TERM_LENGTH || term.length > MAX_SEARCH_TERM_LENGTH) {
      throw new InvalidCardSearchError(
        `The search term must be between ${MIN_SEARCH_TERM_LENGTH} and ${MAX_SEARCH_TERM_LENGTH} characters long`,
      );
    }
    if (FORBIDDEN_CHARACTERS.test(term)) {
      throw new InvalidCardSearchError(
        'The search term must not contain control or invisible characters',
      );
    }

    const limit = props.limit ?? DEFAULT_SEARCH_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
      throw new InvalidCardSearchError(
        `The search limit must be a whole number between 1 and ${MAX_SEARCH_LIMIT}`,
      );
    }

    return new CardNameSearch(term, limit);
  }
}
