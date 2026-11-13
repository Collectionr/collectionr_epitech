/** One slice of a long list, with what a client needs to build the next request. */
export interface Page<T> {
  readonly items: readonly T[];
  /** Number of items in the whole list, not in this slice. */
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}
