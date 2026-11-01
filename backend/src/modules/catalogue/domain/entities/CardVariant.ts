export interface CardVariantProps {
  readonly id: string;
  /**
   * TCGdex variant id. NOT unique on its own: it names a kind of printing and is shared by many
   * cards (the first 16 cards of base1 carry the same four). A printing is a card plus this id.
   */
  readonly tcgdexVariantId: string;
  /** normal, reverse, holo, metal... Codes are English only, the front-end translates them. */
  readonly type: string;
  /** unlimited, shadowless, 1999-2000-copyright... */
  readonly subtype: string | null;
  /** standard or jumbo. */
  readonly size: string;
  /** Stamps printed on the card (1st-edition, pikachu...). */
  readonly stamps: readonly string[];
  /** Foil pattern (gold, rainbow...). */
  readonly foil: string | null;
  /** Product ids at the price sources, to match prices later. */
  readonly cardmarketProductId: number | null;
  readonly tcgplayerProductId: number | null;
  readonly cardtraderProductId: number | null;
}

const FIRST_EDITION_STAMP = '1st-edition';

/** One printing of a card (normal, reverse holo, 1st edition...). Read only. */
export class CardVariant {
  private constructor(
    public readonly id: string,
    public readonly tcgdexVariantId: string,
    public readonly type: string,
    public readonly subtype: string | null,
    public readonly size: string,
    public readonly stamps: readonly string[],
    public readonly foil: string | null,
    public readonly cardmarketProductId: number | null,
    public readonly tcgplayerProductId: number | null,
    public readonly cardtraderProductId: number | null,
  ) {}

  static restore(props: CardVariantProps): CardVariant {
    return new CardVariant(
      props.id,
      props.tcgdexVariantId,
      props.type,
      props.subtype,
      props.size,
      props.stamps,
      props.foil,
      props.cardmarketProductId,
      props.tcgplayerProductId,
      props.cardtraderProductId,
    );
  }

  isFirstEdition(): boolean {
    return this.stamps.includes(FIRST_EDITION_STAMP);
  }
}
