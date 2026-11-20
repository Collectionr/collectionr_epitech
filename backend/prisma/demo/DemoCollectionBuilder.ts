import type { CardCondition } from '../../src/modules/collection/domain/value-objects/CardCondition';
import type { CardLanguage } from '../../src/modules/collection/domain/value-objects/CardLanguage';
import { DEMO_COLLECTION_MAX_ENTRIES, DEMO_COLLECTION_MIN_ENTRIES } from './DemoData';

// Builds the card entries of one demo collection. Pure and framework-free, like CatalogueFixtures.ts.
// "Random" but DETERMINISTIC: the same seed over the same catalogue always gives the same collection,
// so a bug seen on a demo account can be reproduced on any machine.

/** Chance that an entry names a printing (holo, reverse...) rather than just the card. */
const VARIANT_PROBABILITY = 0.5;
/** Chance that an entry is a professionally graded card. */
const GRADED_PROBABILITY = 0.1;
/** Chance that an entry carries a note. */
const NOTE_PROBABILITY = 0.05;
const DEMO_NOTE = 'Bought at a card fair.';

// Cumulative thresholds: most copies are single, a few entries are playsets or bulk.
const QUANTITY_STEPS: readonly (readonly [number, number])[] = [
  [0.6, 1],
  [0.85, 2],
  [0.95, 3],
];
const BULK_QUANTITY_MIN = 4;
const BULK_QUANTITY_SPAN = 3;

// Weights add up to 1: a collector's cards are mostly in good shape.
const CONDITION_WEIGHTS: readonly (readonly [CardCondition, number])[] = [
  ['NM', 0.45],
  ['LP', 0.25],
  ['MP', 0.15],
  ['HP', 0.1],
  ['DMG', 0.05],
];
const FRENCH_PROBABILITY = 0.6;

/** Grades go from 5 to 10 by half points: a demo collection holds no card graded below 5. */
const GRADING_NOTE_FLOOR = 5;
const GRADING_NOTE_STEPS = 11;

export interface DemoEntryData {
  readonly cardId: string;
  readonly variantId: string | null;
  readonly quantity: number;
  readonly condition: CardCondition;
  readonly language: CardLanguage;
  readonly gradingNote: number | null;
  readonly notes: string | null;
}

/** mulberry32: a small seedable generator, so the standard Math.random (unseedable) is not used. */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeighted<T>(random: () => number, weights: readonly (readonly [T, number])[]): T {
  const roll = random();
  let cumulative = 0;
  for (const [value, weight] of weights) {
    cumulative += weight;
    if (roll < cumulative) {
      return value;
    }
  }
  return weights[weights.length - 1][0];
}

function pickQuantity(random: () => number): number {
  const roll = random();
  const step = QUANTITY_STEPS.find(([limit]) => roll < limit);
  return step?.[1] ?? BULK_QUANTITY_MIN + Math.floor(random() * BULK_QUANTITY_SPAN);
}

/** Fisher-Yates on a copy. */
function shuffle<T>(random: () => number, items: readonly T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

/**
 * `cardIds` and every list of `variantIdsByCard` must come in a stable order (the caller sorts them),
 * otherwise the same seed would not give the same collection. Every card appears at most once.
 */
export function buildDemoEntries(
  seed: number,
  cardIds: readonly string[],
  variantIdsByCard: ReadonlyMap<string, readonly string[]>,
): DemoEntryData[] {
  const random = createRandom(seed);
  const span = DEMO_COLLECTION_MAX_ENTRIES - DEMO_COLLECTION_MIN_ENTRIES + 1;
  const size = Math.min(cardIds.length, DEMO_COLLECTION_MIN_ENTRIES + Math.floor(random() * span));

  return shuffle(random, cardIds)
    .slice(0, size)
    .map((cardId) => {
      const variantIds = variantIdsByCard.get(cardId) ?? [];
      const variantId =
        variantIds.length > 0 && random() < VARIANT_PROBABILITY
          ? variantIds[Math.floor(random() * variantIds.length)]
          : null;
      const gradingNote =
        random() < GRADED_PROBABILITY
          ? GRADING_NOTE_FLOOR + Math.floor(random() * GRADING_NOTE_STEPS) / 2
          : null;

      return {
        cardId,
        variantId,
        quantity: pickQuantity(random),
        condition: pickWeighted(random, CONDITION_WEIGHTS),
        language: random() < FRENCH_PROBABILITY ? 'fr' : 'en',
        gradingNote,
        notes: random() < NOTE_PROBABILITY ? DEMO_NOTE : null,
      };
    });
}
