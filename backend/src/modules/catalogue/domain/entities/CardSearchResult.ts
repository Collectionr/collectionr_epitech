export interface CardSearchSetResult {
  readonly id: string;
  readonly tcgdexId: string;
  readonly nameEn: string;
  readonly nameFr: string | null;
  readonly abbreviationOfficial: string | null;
  readonly abbreviationFr: string | null;
}

/** Lightweight read model for autocomplete: no licence or printings are loaded. */
export interface CardSearchResult {
  readonly id: string;
  readonly tcgdexId: string;
  readonly number: string;
  readonly nameEn: string;
  readonly nameFr: string | null;
  readonly imageUrlEn: string | null;
  readonly imageUrlFr: string | null;
  readonly set: CardSearchSetResult;
}
