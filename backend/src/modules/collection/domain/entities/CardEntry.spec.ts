import { CardEntry } from './CardEntry';
import { DomainValidationError } from '../errors/DomainValidationError';

function buildProps() {
  return {
    collectionId: 'collection-1',
    cardId: 'card-1',
    quantity: 2,
    condition: 'NM',
    language: 'fr',
  };
}

function buildEntry(): CardEntry {
  return CardEntry.restore({
    id: 'entry-1',
    collectionId: 'collection-1',
    cardId: 'card-1',
    variantId: 'variant-1',
    quantity: 2,
    condition: 'NM',
    language: 'fr',
    gradingNote: 9.5,
    notes: 'Bought at a fair',
    addedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });
}

describe('CardEntry', () => {
  describe('create', () => {
    it('generates an id and sets addedAt/updatedAt to the same instant', () => {
      const entry = CardEntry.create(buildProps());

      expect(entry.id).toHaveLength(36);
      expect(entry.addedAt).toEqual(entry.updatedAt);
      expect(entry.collectionId).toBe('collection-1');
      expect(entry.cardId).toBe('card-1');
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
        variantId: 'variant-1',
        gradingNote: 8.5,
        notes: 'Signed',
      });

      expect(entry.variantId).toBe('variant-1');
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

    it.each([0, 5, 10, 0.5])('accepts the grading note %s', (gradingNote) => {
      expect(CardEntry.create({ ...buildProps(), gradingNote }).gradingNote).toBe(gradingNote);
    });

    it.each([-0.1, 10.1, Number.NaN, Number.POSITIVE_INFINITY])(
      'rejects the grading note %s',
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

    it('allows line breaks and tabs in the notes', () => {
      expect(CardEntry.create({ ...buildProps(), notes: 'line 1\nline 2\tend' }).notes).toBe(
        'line 1\nline 2\tend',
      );
    });

    it.each([
      ['null byte', 'a\u0000b'],
      ['zero-width space', 'a​b'],
      ['right-to-left override', 'a‮b'],
      ['line separator', 'a b'],
    ])('rejects notes containing a %s', (_label, notes) => {
      expect(() => CardEntry.create({ ...buildProps(), notes })).toThrow(/control or invisible/);
    });

    it.each([
      ['collection', { collectionId: ' ' }],
      ['card', { cardId: '' }],
      ['variant', { variantId: '  ' }],
    ])('refuses a blank %s as a bug, not as a validation error', (_label, override) => {
      const create = () => CardEntry.create({ ...buildProps(), ...override });

      expect(create).toThrow(Error);
      expect(create).not.toThrow(DomainValidationError);
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

  describe('update', () => {
    it('changes only the given fields and keeps identity, card, variant and addedAt', () => {
      const original = buildEntry();

      const updated = original.update({ quantity: 5, condition: 'LP' });

      expect(updated.quantity).toBe(5);
      expect(updated.condition).toBe('LP');
      expect(updated.language).toBe('fr');
      expect(updated.gradingNote).toBe(9.5);
      expect(updated.notes).toBe('Bought at a fair');
      expect(updated.id).toBe(original.id);
      expect(updated.collectionId).toBe(original.collectionId);
      expect(updated.cardId).toBe(original.cardId);
      expect(updated.variantId).toBe('variant-1');
      expect(updated.addedAt).toBe(original.addedAt);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(original.updatedAt.getTime());
      expect(original.quantity).toBe(2);
    });

    it('changes the language', () => {
      expect(buildEntry().update({ language: 'en' }).language).toBe('en');
    });

    it('clears the grading note and the notes with null, and keeps them when undefined', () => {
      const cleared = buildEntry().update({ gradingNote: null, notes: null });
      const untouched = buildEntry().update({});

      expect(cleared.gradingNote).toBeNull();
      expect(cleared.notes).toBeNull();
      expect(untouched.gradingNote).toBe(9.5);
      expect(untouched.notes).toBe('Bought at a fair');
    });

    it('sets a new grading note and new notes', () => {
      const updated = buildEntry().update({ gradingNote: 7, notes: '  resleeved ' });

      expect(updated.gradingNote).toBe(7);
      expect(updated.notes).toBe('resleeved');
    });

    it('applies the creation rules to every changed value', () => {
      expect(() => buildEntry().update({ quantity: 0 })).toThrow(/Quantity must be/);
      expect(() => buildEntry().update({ condition: 'MINT' })).toThrow(/Condition must be/);
      expect(() => buildEntry().update({ language: 'jp' })).toThrow(/Language must be/);
      expect(() => buildEntry().update({ gradingNote: 11 })).toThrow(/Grading note must be/);
      expect(() => buildEntry().update({ notes: 'x'.repeat(501) })).toThrow(/Notes must be/);
    });
  });
});
