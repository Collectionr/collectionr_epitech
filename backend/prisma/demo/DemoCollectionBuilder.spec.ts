import { randomUUID } from 'node:crypto';
import { CardEntry } from '../../src/modules/collection/domain/entities/CardEntry';
import { buildDemoEntries, createRandom } from './DemoCollectionBuilder';
import { DEMO_COLLECTION_MAX_ENTRIES, DEMO_COLLECTION_MIN_ENTRIES, DEMO_USERS } from './DemoData';

// Same size as the reference catalogue (510 cards), with a few printings on every card.
const CARD_IDS = Array.from(
  { length: 510 },
  (_, index) => `card-${String(index).padStart(3, '0')}`,
);
const VARIANTS_BY_CARD = new Map(
  CARD_IDS.map((cardId) => [cardId, [`${cardId}-a`, `${cardId}-b`, `${cardId}-c`]]),
);
const SEEDS = DEMO_USERS.map((_, index) => index + 1);

describe('createRandom', () => {
  it('gives the same sequence for the same seed and another one for another seed', () => {
    const first = createRandom(7);
    const second = createRandom(7);
    const other = createRandom(8);
    const a = [first(), first(), first()];

    expect([second(), second(), second()]).toEqual(a);
    expect([other(), other(), other()]).not.toEqual(a);
  });

  it('stays in [0, 1)', () => {
    const random = createRandom(1);
    for (let draw = 0; draw < 10_000; draw++) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('buildDemoEntries', () => {
  it('is deterministic', () => {
    expect(buildDemoEntries(3, CARD_IDS, VARIANTS_BY_CARD)).toEqual(
      buildDemoEntries(3, CARD_IDS, VARIANTS_BY_CARD),
    );
  });

  it('gives each account a size inside the range, and not always the same one', () => {
    const sizes = SEEDS.map((seed) => buildDemoEntries(seed, CARD_IDS, VARIANTS_BY_CARD).length);

    for (const size of sizes) {
      expect(size).toBeGreaterThanOrEqual(DEMO_COLLECTION_MIN_ENTRIES);
      expect(size).toBeLessThanOrEqual(DEMO_COLLECTION_MAX_ENTRIES);
    }
    expect(new Set(sizes).size).toBeGreaterThan(5);
  });

  it('lists each card at most once, and only cards of the catalogue', () => {
    for (const seed of SEEDS) {
      const cardIds = buildDemoEntries(seed, CARD_IDS, VARIANTS_BY_CARD).map((e) => e.cardId);

      expect(new Set(cardIds).size).toBe(cardIds.length);
      for (const cardId of cardIds) {
        expect(CARD_IDS).toContain(cardId);
      }
    }
  });

  it('only names a printing of the card it belongs to', () => {
    for (const seed of SEEDS) {
      for (const { cardId, variantId } of buildDemoEntries(seed, CARD_IDS, VARIANTS_BY_CARD)) {
        if (variantId !== null) {
          expect(VARIANTS_BY_CARD.get(cardId)).toContain(variantId);
        }
      }
    }
  });

  it('produces entries the Collection domain accepts', () => {
    for (const seed of SEEDS) {
      for (const entry of buildDemoEntries(seed, CARD_IDS, VARIANTS_BY_CARD)) {
        expect(() =>
          CardEntry.create({
            collectionId: randomUUID(),
            cardId: randomUUID(),
            variantId: entry.variantId === null ? null : randomUUID(),
            quantity: entry.quantity,
            condition: entry.condition,
            language: entry.language,
            gradingNote: entry.gradingNote,
            notes: entry.notes,
          }),
        ).not.toThrow();
      }
    }
  });

  it('exercises the API across the ten collections: every condition, both languages, grades, printings, notes', () => {
    const entries = SEEDS.flatMap((seed) => buildDemoEntries(seed, CARD_IDS, VARIANTS_BY_CARD));

    expect(new Set(entries.map((entry) => entry.condition))).toEqual(
      new Set(['NM', 'LP', 'MP', 'HP', 'DMG']),
    );
    expect(new Set(entries.map((entry) => entry.language))).toEqual(new Set(['fr', 'en']));
    expect(entries.some((entry) => entry.gradingNote !== null)).toBe(true);
    expect(entries.some((entry) => entry.variantId !== null)).toBe(true);
    expect(entries.some((entry) => entry.variantId === null)).toBe(true);
    expect(entries.some((entry) => entry.notes !== null)).toBe(true);
    expect(entries.some((entry) => entry.quantity > 1)).toBe(true);
  });

  it('only grades between 5 and 10 by half points', () => {
    const entries = SEEDS.flatMap((seed) => buildDemoEntries(seed, CARD_IDS, VARIANTS_BY_CARD));

    for (const { gradingNote } of entries) {
      if (gradingNote !== null) {
        expect(gradingNote).toBeGreaterThanOrEqual(5);
        expect(gradingNote).toBeLessThanOrEqual(10);
        expect((gradingNote * 2) % 1).toBe(0);
      }
    }
  });

  it('never asks for more cards than the catalogue holds', () => {
    const fewCards = CARD_IDS.slice(0, 160);

    for (const seed of SEEDS) {
      expect(buildDemoEntries(seed, fewCards, VARIANTS_BY_CARD).length).toBeLessThanOrEqual(160);
    }
  });

  it('accepts a card without any printing', () => {
    const entries = buildDemoEntries(1, CARD_IDS, new Map());

    expect(entries.every((entry) => entry.variantId === null)).toBe(true);
  });
});
