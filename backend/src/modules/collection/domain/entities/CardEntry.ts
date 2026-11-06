import { randomUUID } from 'node:crypto';
import { DomainValidationError } from '../errors/DomainValidationError';
import { assertUuid } from '../rules/AssertUuid';
import {
  CARD_ENTRY_MAX_QUANTITY,
  CARD_ENTRY_MIN_QUANTITY,
  CARD_ENTRY_NOTES_MAX_LENGTH,
  GRADING_NOTE_MAX,
  GRADING_NOTE_MIN,
} from '../rules/CollectionLimits';
import { characterCount, hasInvisibleCharactersInFreeText } from '../rules/TextRules';
import { parseCardCondition } from '../value-objects/CardCondition';
import type { CardCondition } from '../value-objects/CardCondition';
import { parseCardLanguage } from '../value-objects/CardLanguage';
import type { CardLanguage } from '../value-objects/CardLanguage';

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
  /** Professional grade, 0 to 10 with at most one decimal. null when the card is not graded. */
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
 * What an update may change, as the caller sends it. The card and the printing are NOT in it:
 * they are what the entry is, so a collector who picked the wrong card removes the entry and adds
 * another. `undefined` leaves a field alone; `null` (gradingNote, notes) clears it.
 */
export interface CardEntryChanges {
  readonly quantity?: number;
  readonly condition?: string;
  readonly language?: string;
  readonly gradingNote?: number | null;
  readonly notes?: string | null;
}

/** Type-only brand (no runtime value): see ValidCardEntryChanges. */
export declare const validatedChanges: unique symbol;

/**
 * CardEntryChanges once validated and normalized (trimmed notes, parsed condition and language).
 * It holds ONLY the fields to change: a repository writes exactly these and leaves every other
 * column alone, so two concurrent edits of different fields never undo each other, and it holds
 * at least one. The brand makes `CardEntry.validateChanges` the only way to obtain one: an object
 * literal such as `{ quantity: -5 }` or `{}` does not type-check as a ValidCardEntryChanges, so a
 * future caller of the port (a job, an import) cannot skip the rules.
 */
export interface ValidCardEntryChanges {
  readonly [validatedChanges]: true;
  readonly quantity?: number;
  readonly condition?: CardCondition;
  readonly language?: CardLanguage;
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

  /**
   * Not graded is null; a grade is a real number on the 0 to 10 scale with at most one decimal, so
   * the stored value (a decimal(3,1) column) is exactly the value that was validated.
   */
  static normalizeGradingNote(gradingNote: number | null | undefined): number | null {
    if (gradingNote === null || gradingNote === undefined) {
      return null;
    }
    if (
      !Number.isFinite(gradingNote) ||
      gradingNote < GRADING_NOTE_MIN ||
      gradingNote > GRADING_NOTE_MAX ||
      Math.round(gradingNote * 10) / 10 !== gradingNote
    ) {
      throw new DomainValidationError(
        `Grading note must be a number between ${GRADING_NOTE_MIN} and ${GRADING_NOTE_MAX} with at most one decimal`,
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
    if (characterCount(trimmed) > CARD_ENTRY_NOTES_MAX_LENGTH) {
      throw new DomainValidationError(
        `Notes must be at most ${CARD_ENTRY_NOTES_MAX_LENGTH} characters long`,
      );
    }
    // Line breaks and tabs are legitimate in free text, other invisible characters are not.
    if (hasInvisibleCharactersInFreeText(trimmed)) {
      throw new DomainValidationError('Notes must not contain control or invisible characters');
    }
    return trimmed;
  }

  static create(props: NewCardEntryProps): CardEntry {
    assertUuid(props.collectionId, 'Collection id');
    assertUuid(props.cardId, 'Card id');
    const variantId = props.variantId ?? null;
    if (variantId !== null) {
      assertUuid(variantId, 'Variant id');
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

  /**
   * Applies the creation rules to every field of an update and returns only the fields to write.
   * An update that changes nothing is a client mistake, not a no-op to store.
   */
  static validateChanges(changes: CardEntryChanges): ValidCardEntryChanges {
    const valid: {
      quantity?: number;
      condition?: CardCondition;
      language?: CardLanguage;
      gradingNote?: number | null;
      notes?: string | null;
    } = {};

    if (changes.quantity !== undefined) {
      CardEntry.assertValidQuantity(changes.quantity);
      valid.quantity = changes.quantity;
    }
    if (changes.condition !== undefined) {
      valid.condition = parseCardCondition(changes.condition);
    }
    if (changes.language !== undefined) {
      valid.language = parseCardLanguage(changes.language);
    }
    if (changes.gradingNote !== undefined) {
      valid.gradingNote = CardEntry.normalizeGradingNote(changes.gradingNote);
    }
    if (changes.notes !== undefined) {
      valid.notes = CardEntry.normalizeNotes(changes.notes);
    }

    if (Object.keys(valid).length === 0) {
      throw new DomainValidationError('At least one field must be changed');
    }
    return valid as ValidCardEntryChanges;
  }
}
