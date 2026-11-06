import { randomUUID } from 'node:crypto';
import { CardEntry } from './CardEntry';
import { DomainValidationError } from '../errors/DomainValidationError';

const COLLECTION_ID = randomUUID();
const CARD_ID = randomUUID();
const VARIANT_ID = randomUUID();

function buildProps() {
  return {
    collectionId: COLLECTION_ID,
    cardId: CARD_ID,
    quantity: 2,
    condition: 'NM',
    language: 'fr',
  };
}

describe('CardEntry', () => {
  describe('create', () => {
    it('generates an id and sets addedAt/updatedAt to the same instant', () => {
      const entry = CardEntry.create(buildProps());

      expect(entry.id).toHaveLength(36);
      expect(entry.addedAt).toEqual(entry.updatedAt);
      expect(entry.collectionId).toBe(COLLECTION_ID);
      expect(entry.cardId).toBe(CARD_ID);
      expect(entry.quantity).toBe(2);
      expect(entry.condition).toBe('NM');
      expect(entry.language).toBe('fr');
    });

    it('defaults the optional fields to null', () => {
      const entry = CardEntry.create(buildProps());

      expect(entry.variantId).toBeNull();
      expect(entry.gradingNote).toBeNull();
      expect(entry.notes).toBeNull();
    });

    it('keeps the variant, the grading note and the notes when given', () => {
      const entry = CardEntry.create({
        ...buildProps(),
        variantId: VARIANT_ID,
        gradingNote: 8.5,
        notes: 'Signed',
      });

      expect(entry.variantId).toBe(VARIANT_ID);
      expect(entry.gradingNote).toBe(8.5);
      expect(entry.notes).toBe('Signed');
    });

    it.each([1, 9999])('accepts the quantity %d', (quantity) => {
      expect(CardEntry.create({ ...buildProps(), quantity }).quantity).toBe(quantity);
    });

    it.each([0, -1, 10000, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the quantity %s',
      (quantity) => {
        expect(() => CardEntry.create({ ...buildProps(), quantity })).toThrow(
          DomainValidationError,
        );
        expect(() => CardEntry.create({ ...buildProps(), quantity })).toThrow(
          /Quantity must be an integer/,
        );
      },
    );

    it.each(['NM', 'LP', 'MP', 'HP', 'DMG'])('accepts the condition %s', (condition) => {
      expect(CardEntry.create({ ...buildProps(), condition }).condition).toBe(condition);
    });

    it.each(['', 'nm', 'MINT', 'PSA 10'])('rejects the condition "%s"', (condition) => {
      expect(() => CardEntry.create({ ...buildProps(), condition })).toThrow(/Condition must be/);
    });

    it.each(['fr', 'en'])('accepts the language %s', (language) => {
      expect(CardEntry.create({ ...buildProps(), language }).language).toBe(language);
    });

    it.each(['', 'FR', 'jp', 'french'])('rejects the language "%s"', (language) => {
      expect(() => CardEntry.create({ ...buildProps(), language })).toThrow(/Language must be/);
    });

    it.each([0, 5, 10, 0.5, 9.9])('accepts the grading note %s', (gradingNote) => {
      expect(CardEntry.create({ ...buildProps(), gradingNote }).gradingNote).toBe(gradingNote);
    });

    it.each([-0.1, 10.1, 9.55, 9.123456789, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the grading note %s (out of 0-10, more than one decimal, or not a number)',
      (gradingNote) => {
        expect(() => CardEntry.create({ ...buildProps(), gradingNote })).toThrow(
          /Grading note must be/,
        );
      },
    );

    it('trims the notes and stores blank notes as null', () => {
      expect(CardEntry.create({ ...buildProps(), notes: '  hello  ' }).notes).toBe('hello');
      expect(CardEntry.create({ ...buildProps(), notes: '   ' }).notes).toBeNull();
    });

    it('rejects notes longer than the limit, and accepts the limit itself', () => {
      expect(() => CardEntry.create({ ...buildProps(), notes: 'x'.repeat(501) })).toThrow(
        /Notes must be at most/,
      );
      expect(CardEntry.create({ ...buildProps(), notes: 'x'.repeat(500) }).notes).toHaveLength(500);
    });

    it('counts characters as a person does: 500 emoji fit', () => {
      expect(() => CardEntry.create({ ...buildProps(), notes: '😀'.repeat(500) })).not.toThrow();
      expect(() => CardEntry.create({ ...buildProps(), notes: '😀'.repeat(501) })).toThrow(
        /Notes must be at most/,
      );
    });

    it('accepts emoji in the notes, including composed ones', () => {
      const notes = '1ère édition ❤\uFE0F ⚡\uFE0F \u{1F468}\u200D\u{1F469}\u200D\u{1F467}';

      expect(CardEntry.create({ ...buildProps(), notes }).notes).toBe(notes);
    });

    it('allows line breaks and tabs in the notes', () => {
      expect(CardEntry.create({ ...buildProps(), notes: 'line 1\nline 2\tend' }).notes).toBe(
        'line 1\nline 2\tend',
      );
    });

    it.each([
      ['null byte', 'a\u0000b'],
      ['zero-width space', 'a\u200Bb'],
      ['right-to-left override', 'a\u202Eb'],
      ['line separator', 'a\u2028b'],
      ['Hangul filler', 'a\u3164b'],
    ])('rejects notes containing a %s', (_label, notes) => {
      expect(() => CardEntry.create({ ...buildProps(), notes })).toThrow(/control or invisible/);
    });

    it.each([
      ['collection id', { collectionId: 'collection-1' }, 'Collection id'],
      ['card id', { cardId: ' ' }, 'Card id'],
      ['variant id', { variantId: '' }, 'Variant id'],
    ])('rejects a %s that is not a UUID, as a validation error', (_label, override, field) => {
      const create = () => CardEntry.create({ ...buildProps(), ...override });

      expect(create).toThrow(DomainValidationError);
      expect(create).toThrow(`${field} must be a valid UUID`);
    });
  });

  describe('restore', () => {
    it('rebuilds an entry without re-validating stored values', () => {
      const entry = CardEntry.restore({
        id: 'entry-1',
        collectionId: 'collection-1',
        cardId: 'card-1',
        variantId: null,
        quantity: 100000,
        condition: 'NM',
        language: 'fr',
        gradingNote: 11,
        notes: null,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      expect(entry.quantity).toBe(100000);
      expect(entry.gradingNote).toBe(11);
    });
  });

  describe('validateChanges', () => {
    it('returns only the fields that were given, normalized', () => {
      const valid = CardEntry.validateChanges({
        quantity: 5,
        condition: 'LP',
        notes: '  resleeved ',
      });

      expect(valid).toEqual({ quantity: 5, condition: 'LP', notes: 'resleeved' });
    });

    it('keeps null to clear the grading note and the notes, and leaves out what is undefined', () => {
      const valid = CardEntry.validateChanges({ gradingNote: null, notes: null });

      expect(valid).toEqual({ gradingNote: null, notes: null });
      expect(valid).not.toHaveProperty('quantity');
    });

    it('normalizes blank notes to null', () => {
      expect(CardEntry.validateChanges({ notes: '   ' })).toEqual({ notes: null });
    });

    it('changes the language', () => {
      expect(CardEntry.validateChanges({ language: 'en' })).toEqual({ language: 'en' });
    });

    it('sets a new grading note', () => {
      expect(CardEntry.validateChanges({ gradingNote: 7 })).toEqual({ gradingNote: 7 });
    });

    it('applies the creation rules to every changed value', () => {
      expect(() => CardEntry.validateChanges({ quantity: 0 })).toThrow(/Quantity must be/);
      expect(() => CardEntry.validateChanges({ condition: 'MINT' })).toThrow(/Condition must be/);
      expect(() => CardEntry.validateChanges({ language: 'jp' })).toThrow(/Language must be/);
      expect(() => CardEntry.validateChanges({ gradingNote: 11 })).toThrow(/Grading note must be/);
      expect(() => CardEntry.validateChanges({ notes: 'x'.repeat(501) })).toThrow(/Notes must be/);
    });

    it('rejects an update that changes nothing, as a validation error', () => {
      expect(() => CardEntry.validateChanges({})).toThrow(DomainValidationError);
      expect(() => CardEntry.validateChanges({})).toThrow('At least one field must be changed');
      expect(() => CardEntry.validateChanges({ quantity: undefined })).toThrow(
        'At least one field must be changed',
      );
    });
  });
});
