import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '../errors/DomainValidationError';
import {
  CARD_ENTRY_MAX_QUANTITY,
  CARD_ENTRY_MIN_QUANTITY,
  CARD_ENTRY_NOTES_MAX_LENGTH,
  GRADING_NOTE_MAX,
  GRADING_NOTE_MIN,
} from '../rules/CollectionLimits';
import { parseCardCondition } from '../value-objects/CardCondition';
import type { CardCondition } from '../value-objects/CardCondition';
import { parseCardLanguage } from '../value-objects/CardLanguage';
import type { CardLanguage } from '../value-objects/CardLanguage';

// Same as for names (control, format and separator characters), but notes are free text: line
// breaks and tabs are legitimate there and are removed before the check.
const NOTES_FORBIDDEN_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const NOTES_ALLOWED_WHITESPACE = /[\n\r\t]/g;

export interface NewCardEntryProps {
  readonly collectionId: string;
  /** The catalogue card. Always required (docs/database/documentation-metier.md, cardId/variantId rule). */
  readonly cardId: string;
  /** The printing (holo, reverse...), only when known and relevant. When set, it belongs to `cardId`. */
  readonly variantId?: string | null;
  readonly quantity: number;
  /** Raw text: validated here (see parseCardCondition) so a caller cannot skip the rule with a cast. */
  readonly condition: string;
  /** Raw text: validated here (see parseCardLanguage). */
  readonly language: string;
  /** Professional or AI grade, 0 to 10. null when the card is not graded. */
  readonly gradingNote?: number | null;
  readonly notes?: string | null;
}

export interface CardEntryProps {
  readonly id: string;
  readonly collectionId: string;
  readonly cardId: string;
  readonly variantId: string | null;
  readonly quantity: number;
  readonly condition: CardCondition;
  readonly language: CardLanguage;
  readonly gradingNote: number | null;
  readonly notes: string | null;
  readonly addedAt: Date;
  readonly updatedAt: Date;
}

/**
 * What an update may change. The card and the printing are NOT in it: they are what the entry is,
 * so a collector who picked the wrong card removes the entry and adds another. `undefined` keeps
 * the current value; `null` (gradingNote, notes) clears it.
 */
export interface CardEntryChanges {
  readonly quantity?: number;
  readonly condition?: string;
  readonly language?: string;
  readonly gradingNote?: number | null;
  readonly notes?: string | null;
}

/** One line of a collection: copies of one card (or printing) in a declared condition and language. */
export class CardEntry {
  private constructor(
    public readonly id: string,
    public readonly collectionId: string,
    public readonly cardId: string,
    public readonly variantId: string | null,
    public readonly quantity: number,
    public readonly condition: CardCondition,
    public readonly language: CardLanguage,
    public readonly gradingNote: number | null,
    public readonly notes: string | null,
    public readonly addedAt: Date,
    public readonly updatedAt: Date,
  ) {}

  static assertValidQuantity(quantity: number): void {
    if (
      !Number.isInteger(quantity) ||
      quantity < CARD_ENTRY_MIN_QUANTITY ||
      quantity > CARD_ENTRY_MAX_QUANTITY
    ) {
      throw new DomainValidationError(
        `Quantity must be an integer between ${CARD_ENTRY_MIN_QUANTITY} and ${CARD_ENTRY_MAX_QUANTITY}`,
      );
    }
  }

  /** Not graded is null; a grade must be a real number on the 0 to 10 scale (NaN and Infinity are not). */
  static normalizeGradingNote(gradingNote: number | null | undefined): number | null {
    if (gradingNote === null || gradingNote === undefined) {
      return null;
    }
    if (
      !Number.isFinite(gradingNote) ||
      gradingNote < GRADING_NOTE_MIN ||
      gradingNote > GRADING_NOTE_MAX
    ) {
      throw new DomainValidationError(
        `Grading note must be a number between ${GRADING_NOTE_MIN} and ${GRADING_NOTE_MAX}`,
      );
    }
    return gradingNote;
  }

  /** Free text, trimmed. Blank means "no note" and is stored as null. */
  static normalizeNotes(notes: string | null | undefined): string | null {
    const trimmed = notes?.trim() ?? '';
    if (trimmed === '') {
      return null;
    }
    if (trimmed.length > CARD_ENTRY_NOTES_MAX_LENGTH) {
      throw new DomainValidationError(
        `Notes must be at most ${CARD_ENTRY_NOTES_MAX_LENGTH} characters long`,
      );
    }
    if (NOTES_FORBIDDEN_CHARACTERS.test(trimmed.replace(NOTES_ALLOWED_WHITESPACE, ''))) {
      throw new DomainValidationError('Notes must not contain control or invisible characters');
    }
    return trimmed;
  }

  static create(props: NewCardEntryProps): CardEntry {
    // Not user mistakes: ids come from the URL / the catalogue and are validated by the interface
    // layer, so a blank one is a bug that must not be stored.
    if (props.collectionId.trim() === '' || props.cardId.trim() === '') {
      throw new Error('A card entry cannot be created without a collection and a card');
    }
    const variantId = props.variantId ?? null;
    if (variantId !== null && variantId.trim() === '') {
      throw new Error('A card entry variant, when given, must not be blank');
    }
    CardEntry.assertValidQuantity(props.quantity);
    const now = new Date();

    return new CardEntry(
      randomUUID(),
      props.collectionId,
      props.cardId,
      variantId,
      props.quantity,
      parseCardCondition(props.condition),
      parseCardLanguage(props.language),
      CardEntry.normalizeGradingNote(props.gradingNote),
      CardEntry.normalizeNotes(props.notes),
      now,
      now,
    );
  }

  /**
   * Rebuilds a CardEntry from data already persisted (used by repository implementations).
   * Deliberately does not re-validate: stored data was valid under the rules of its time, and
   * tightening a rule later must not make existing entries impossible to load.
   */
  static restore(props: CardEntryProps): CardEntry {
    return new CardEntry(
      props.id,
      props.collectionId,
      props.cardId,
      props.variantId,
      props.quantity,
      props.condition,
      props.language,
      props.gradingNote,
      props.notes,
      props.addedAt,
      props.updatedAt,
    );
  }

  /** Applies the given changes; every changed value goes through the same rules as at creation. */
  update(changes: CardEntryChanges): CardEntry {
    if (changes.quantity !== undefined) {
      CardEntry.assertValidQuantity(changes.quantity);
    }

    return new CardEntry(
      this.id,
      this.collectionId,
      this.cardId,
      this.variantId,
      changes.quantity ?? this.quantity,
      changes.condition === undefined ? this.condition : parseCardCondition(changes.condition),
      changes.language === undefined ? this.language : parseCardLanguage(changes.language),
      changes.gradingNote === undefined
        ? this.gradingNote
        : CardEntry.normalizeGradingNote(changes.gradingNote),
      changes.notes === undefined ? this.notes : CardEntry.normalizeNotes(changes.notes),
      this.addedAt,
      new Date(),
    );
  }
}
