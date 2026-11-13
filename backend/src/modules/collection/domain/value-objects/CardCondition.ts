import { DomainValidationError } from '../errors/DomainValidationError';

/**
 * Declared physical condition of a card (docs/database/documentation-metier.md): Near Mint,
 * Lightly Played, Moderately Played, Heavily Played, Damaged. "Declared" because it is what the
 * collector says, not an assessment (that is the grading result).
 */
export const CARD_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;

export type CardCondition = (typeof CARD_CONDITIONS)[number];

export function parseCardCondition(raw: string): CardCondition {
  const condition = CARD_CONDITIONS.find((candidate) => candidate === raw);
  if (condition === undefined) {
    throw new DomainValidationError(`Condition must be one of: ${CARD_CONDITIONS.join(', ')}`);
  }
  return condition;
}
