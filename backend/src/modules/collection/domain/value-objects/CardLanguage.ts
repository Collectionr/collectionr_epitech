import { DomainValidationError } from '../errors/DomainValidationError';

/**
 * Language of the physical card. It decides which catalogue text and which price the entry is
 * matched with (CDC §3.1.4). French and English only: other languages (Japanese...) are out of
 * the V1 scope (CDC §1.3, §3.3).
 */
export const CARD_LANGUAGES = ['fr', 'en'] as const;

export type CardLanguage = (typeof CARD_LANGUAGES)[number];

export function parseCardLanguage(raw: string): CardLanguage {
  const language = CARD_LANGUAGES.find((candidate) => candidate === raw);
  if (language === undefined) {
    throw new DomainValidationError(`Language must be one of: ${CARD_LANGUAGES.join(', ')}`);
  }
  return language;
}
