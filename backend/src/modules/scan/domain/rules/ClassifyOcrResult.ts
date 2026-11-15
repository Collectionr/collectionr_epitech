import type { OcrCardResult } from '../entities/OcrMessages';
import { OCR_CONFIDENCE_HIGH, OCR_CONFIDENCE_LOW } from './OcrPolicy';

/**
 * How much the backend trusts a result. The user always confirms before a card is added
 * (COLLR-623, CDC §3.4.1); the class only decides what is shown first:
 * - `high`: a likely match, offered as the preselected candidate.
 * - `low`: candidates are listed with a "check the card" warning.
 * - `unidentified`: "carte non identifiée" (CDC §3.4.1): nothing is proposed, a manual confirmation
 *   (search or manual entry) is offered, and scanning again stays possible.
 */
export type OcrResultQuality = 'high' | 'low' | 'unidentified';

export function classifyOcrResult(result: OcrCardResult): OcrResultQuality {
  const nothingRead = result.name === null && result.setNumber === null;
  if (nothingRead || result.confidence < OCR_CONFIDENCE_LOW) {
    return 'unidentified';
  }
  // The name alone matches one card per set and the number alone matches one per set too: only
  // both together point at a single card, so a high score without both stays a "low" result.
  const identifiesOneCard = result.name !== null && result.setNumber !== null;
  if (result.confidence >= OCR_CONFIDENCE_HIGH && identifiesOneCard) {
    return 'high';
  }
  return 'low';
}
