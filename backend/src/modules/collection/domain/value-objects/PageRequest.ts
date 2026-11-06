import { DEFAULT_PAGE_SIZE, MAX_PAGE, MAX_PAGE_SIZE } from '../rules/CollectionLimits';
import { DomainValidationError } from '../errors/DomainValidationError';

export interface PageRequestInput {
  readonly page?: number;
  readonly pageSize?: number;
}

/** Which slice of a long list the caller wants. Page numbers start at 1. */
export class PageRequest {
  private constructor(
    public readonly page: number,
    public readonly pageSize: number,
  ) {}

  /**
   * A missing value takes its default; an invalid one is rejected rather than silently corrected,
   * so a client bug (page 0, pageSize 100000) shows up instead of returning a surprising slice.
   */
  static create(input: PageRequestInput = {}): PageRequest {
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;

    if (!Number.isInteger(page) || page < 1 || page > MAX_PAGE) {
      throw new DomainValidationError(`Page must be an integer between 1 and ${MAX_PAGE}`);
    }
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
      throw new DomainValidationError(
        `Page size must be an integer between 1 and ${MAX_PAGE_SIZE}`,
      );
    }

    return new PageRequest(page, pageSize);
  }

  /** Number of items to skip. */
  get offset(): number {
    return (this.page - 1) * this.pageSize;
  }
}
