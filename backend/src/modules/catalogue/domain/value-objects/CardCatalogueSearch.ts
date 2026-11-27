import { InvalidCardSearchError } from '../errors/InvalidCardSearchError';
import {
  DEFAULT_SEARCH_LIMIT,
  MAX_SEARCH_LIMIT,
  MAX_SEARCH_TERM_LENGTH,
  MIN_SEARCH_TERM_LENGTH,
} from './CardNameSearch';

const FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

export type CatalogueSearchLanguage = 'en' | 'fr';

export interface CardCatalogueSearchProps {
  readonly query?: string;
  readonly name?: string;
  readonly set?: string;
  readonly number?: string;
  readonly language?: CatalogueSearchLanguage;
  readonly limit?: number;
}

/** A validated catalogue-search request shared by all catalogue callers. */
export class CardCatalogueSearch {
  private constructor(
    public readonly query: string | null,
    public readonly name: string | null,
    public readonly set: string | null,
    public readonly number: string | null,
    public readonly language: CatalogueSearchLanguage,
    public readonly limit: number,
  ) {}

  static create(props: CardCatalogueSearchProps): CardCatalogueSearch {
    const normalize = (value: string | undefined): string | null => {
      if (value === undefined) {
        return null;
      }
      const normalized = value.trim().normalize('NFC');
      return normalized.length === 0 ? null : normalized;
    };

    const query = normalize(props.query);
    const name = normalize(props.name);
    const set = normalize(props.set);
    const number = normalize(props.number);

    if (query === null && name === null && set === null && number === null) {
      throw new InvalidCardSearchError(
        'At least one search parameter (query, name, set or number) is required',
      );
    }

    for (const term of [query, name, set, number]) {
      if (term === null) {
        continue;
      }
      const minimumLength = term === number ? 1 : MIN_SEARCH_TERM_LENGTH;
      if (term.length < minimumLength || term.length > MAX_SEARCH_TERM_LENGTH) {
        throw new InvalidCardSearchError(
          `The search term must be between ${minimumLength} and ${MAX_SEARCH_TERM_LENGTH} characters long`,
        );
      }
      if (FORBIDDEN_CHARACTERS.test(term)) {
        throw new InvalidCardSearchError(
          'The search term must not contain control or invisible characters',
        );
      }
    }

    const limit = props.limit ?? DEFAULT_SEARCH_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_SEARCH_LIMIT) {
      throw new InvalidCardSearchError(
        `The search limit must be a whole number between 1 and ${MAX_SEARCH_LIMIT}`,
      );
    }

    return new CardCatalogueSearch(query, name, set, number, props.language ?? 'en', limit);
  }
}
