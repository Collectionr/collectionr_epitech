import type { CatalogueLanguage } from '../value-objects/CatalogueLanguage';
import type { LocalizedText } from '../value-objects/LocalizedText';
import type { LocalizedUrl } from '../value-objects/LocalizedUrl';
import type { CardSet } from './CardSet';
import type { CardVariant } from './CardVariant';

export interface CardProps {
  readonly id: string;
  readonly set: CardSet;
  /** TCGdex card id, the same in every language (swsh3-20, sv03.5-006). */
  readonly tcgdexId: string;
  /** Number inside the set, as printed: a string because of leading zeros (006) and prefixes (TG01). */
  readonly number: string;
  readonly name: LocalizedText;
  /** Pokemon, Trainer or Energy. English only: the front-end translates it. */
  readonly category: string;
  /** Rarity as TCGdex words it in English. A code: the front-end translates it. */
  readonly rarity: string | null;
  readonly illustrator: string | null;
  readonly hp: number | null;
  /** Energy types in English (Fire, Water...). */
  readonly types: readonly string[];
  /** National Pokedex numbers: links every card of the same Pokemon, across sets and languages. */
  readonly dexIds: readonly number[];
  /** The Pokemon this one evolves from (Reptincel for a Dracaufeu card), when there is one. */
  readonly evolveFrom: LocalizedText | null;
  /** Basic, Stage1, Stage2, VMAX... English only. */
  readonly stage: string | null;
  /** Last modification of the card on the TCGdex side. */
  readonly tcgdexUpdatedAt: Date | null;
  /** Base URLs of the card image on the TCGdex CDN, without quality nor extension. */
  readonly image: LocalizedUrl;
  readonly variants: readonly CardVariant[];
}

// Numeric collation puts 9 before 10 and 006 before TG01: the order of a printed number.
const NUMBER_COLLATOR = new Intl.Collator('en', { numeric: true });

/** A card of the catalogue, with the set it belongs to and its printings. Read only. */
export class Card {
  private constructor(
    public readonly id: string,
    public readonly set: CardSet,
    public readonly tcgdexId: string,
    public readonly number: string,
    public readonly name: LocalizedText,
    public readonly category: string,
    public readonly rarity: string | null,
    public readonly illustrator: string | null,
    public readonly hp: number | null,
    public readonly types: readonly string[],
    public readonly dexIds: readonly number[],
    public readonly evolveFrom: LocalizedText | null,
    public readonly stage: string | null,
    public readonly tcgdexUpdatedAt: Date | null,
    public readonly image: LocalizedUrl,
    public readonly variants: readonly CardVariant[],
  ) {}

  static restore(props: CardProps): Card {
    return new Card(
      props.id,
      props.set,
      props.tcgdexId,
      props.number,
      props.name,
      props.category,
      props.rarity,
      props.illustrator,
      props.hp,
      props.types,
      props.dexIds,
      props.evolveFrom,
      props.stage,
      props.tcgdexUpdatedAt,
      props.image,
      props.variants,
    );
  }

  /** Orders cards the way they are numbered in their set (2, 10, 100, TG01). */
  static compareByNumber(a: Card, b: Card): number {
    return NUMBER_COLLATOR.compare(a.number, b.number);
  }

  nameIn(language: CatalogueLanguage): string {
    return this.name.in(language);
  }

  /** Base URL of the image in the requested language, or in the other one when TCGdex has none. */
  imageBaseUrlIn(language: CatalogueLanguage): string | null {
    return this.image.in(language);
  }

  /** A printing is found by the id TCGdex gives it, which only means something inside one card. */
  findVariant(tcgdexVariantId: string): CardVariant | null {
    return this.variants.find((variant) => variant.tcgdexVariantId === tcgdexVariantId) ?? null;
  }
}
