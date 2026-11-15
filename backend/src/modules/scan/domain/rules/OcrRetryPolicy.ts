import { OCR_FAILURES } from '../value-objects/OcrFailureCode';
import type { OcrFailureCode } from '../value-objects/OcrFailureCode';
import { OCR_MAX_ATTEMPTS } from './OcrPolicy';

/**
 * Whether a failed scan is queued again. `attempt` is the number of the try that just failed
 * (1 for the first). The deadline is a separate limit: a retry past `expires_at` is pointless, the
 * caller checks it with isOcrJobExpired.
 */
export function shouldRetryOcrJob(code: OcrFailureCode, attempt: number): boolean {
  return OCR_FAILURES[code].retryable && attempt < OCR_MAX_ATTEMPTS;
}
