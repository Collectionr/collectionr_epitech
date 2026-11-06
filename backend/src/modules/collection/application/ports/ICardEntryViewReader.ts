import type { CardEntry } from '../../domain/entities/CardEntry';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import type { Page } from './Page';

export const CARD_ENTRY_VIEW_READER = 'CARD_ENTRY_VIEW_READER';

/** The catalogue card an entry points at, as the collection screen shows it. */
export interface CardEntryCardView {
  readonly id: string;
  /** Number inside the set, as printed (a string: 006, TG01). */
  readonly number: string;
  readonly nameEn: string;
  /** null when the catalogue has no French name. */
  readonly nameFr: string | null;
  readonly category: string;
  readonly rarity: string | null;
  /** TCGdex base URLs without extension (the front adds /low.webp or /high.webp). */
  readonly imageUrlEn: string | null;
  readonly imageUrlFr: string | null;
}

export interface CardEntrySetView {
  readonly id: string;
  readonly tcgdexId: string;
  readonly nameEn: string;
  readonly nameFr: string | null;
  readonly abbreviationOfficial: string | null;
}

/** The printing an entry points at, when it names one. */
export interface CardEntryVariantView {
  readonly id: string;
  readonly type: string;
  readonly subtype: string | null;
  readonly size: string;
  readonly stamps: readonly string[];
  readonly foil: string | null;
}

/**
 * One line of a collection with what the screen needs to display it. A `CardEntry` only holds
 * identifiers: name, image and set come from the catalogue.
 *
 * No price here: no price table exists yet (no backend ticket for `CardPrice`), so there is nothing
 * to join. When it does, the price joins this view, not the domain entry.
 */
export interface CardEntryView {
  readonly entry: CardEntry;
  readonly card: CardEntryCardView;
  readonly set: CardEntrySetView;
  readonly variant: CardEntryVariantView | null;
}

/**
 * Read model of `/collections/:id/cards` (ADR-017). Separate from `ICollectionRepository` on
 * purpose: the repository is the write side of the collection and knows nothing of the catalogue;
 * this port crosses both for display and never writes. Same order and pagination as
 * `ICollectionRepository.findCardEntries` (newest first, ties on the id), and, like it, an empty
 * page for a collection that matches nothing. Ownership is checked by the use case, not here.
 */
export interface ICardEntryViewReader {
  findCardEntryViews(collectionId: string, page: PageRequest): Promise<Page<CardEntryView>>;
}
