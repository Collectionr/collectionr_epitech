import type { LocalizedText } from '../value-objects/LocalizedText';
import type { LocalizedUrl } from '../value-objects/LocalizedUrl';
import type { LicenceTCG } from './LicenceTCG';

/** The series a set belongs to (e.g. swsh = Sword and Shield, Epee et Bouclier in French). */
export interface CardSetSerie {
  readonly tcgdexId: string;
  readonly name: LocalizedText;
}

/**
 * How many printings of each kind TCGdex counts in the set. One card can be counted in several
 * kinds (normal and reverse holo), so they do not add up to the number of cards.
 */
export interface CardSetPrintingCounts {
  readonly normal: number | null;
  readonly reverse: number | null;
  readonly holo: number | null;
  readonly firstEdition: number | null;
}

export interface CardSetProps {
  readonly id: string;
  readonly licenceTCG: LicenceTCG;
  /** TCGdex set id, the same in every language (base1, swsh3, sv03.5). */
  readonly tcgdexId: string;
  readonly name: LocalizedText;
  readonly serie: CardSetSerie | null;
  readonly releaseDate: Date | null;
  /** Code printed on the cards of the set (e.g. DAA). */
  readonly abbreviationOfficial: string | null;
  /** French code when it differs from the official one (e.g. TEM). */
  readonly abbreviationFr: string | null;
  /** Code of the set in Pokemon TCG Online / Live, absent for the most recent sets. */
  readonly tcgOnlineCode: string | null;
  /** Cards printed in the set (189 for swsh3). */
  readonly officialCardCount: number;
  /** Cards of the set including the secret rares (201 for swsh3): the base of a completion. */
  readonly totalCardCount: number;
  readonly printingCounts: CardSetPrintingCounts;
  readonly logo: LocalizedUrl;
  readonly symbolUrl: string | null;
}

/**
 * An expansion of a licence. Named CardSet and not Set so it never shadows the JavaScript Set.
 * Read only, like the rest of the catalogue.
 */
export class CardSet {
  private constructor(
    public readonly id: string,
    public readonly licenceTCG: LicenceTCG,
    public readonly tcgdexId: string,
    public readonly name: LocalizedText,
    public readonly serie: CardSetSerie | null,
    public readonly releaseDate: Date | null,
    public readonly abbreviationOfficial: string | null,
    public readonly abbreviationFr: string | null,
    public readonly tcgOnlineCode: string | null,
    public readonly officialCardCount: number,
    public readonly totalCardCount: number,
    public readonly printingCounts: CardSetPrintingCounts,
    public readonly logo: LocalizedUrl,
    public readonly symbolUrl: string | null,
  ) {}

  static restore(props: CardSetProps): CardSet {
    return new CardSet(
      props.id,
      props.licenceTCG,
      props.tcgdexId,
      props.name,
      props.serie,
      props.releaseDate,
      props.abbreviationOfficial,
      props.abbreviationFr,
      props.tcgOnlineCode,
      props.officialCardCount,
      props.totalCardCount,
      props.printingCounts,
      props.logo,
      props.symbolUrl,
    );
  }
}
