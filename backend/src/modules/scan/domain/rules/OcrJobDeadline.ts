import { OCR_JOB_TIMEOUT_MS } from './OcrPolicy';

/** Moment after which nobody is waiting for the scan any more (worker and backend both stop). */
export function computeOcrExpiresAt(
  submittedAt: Date,
  timeoutMs: number = OCR_JOB_TIMEOUT_MS,
): Date {
  return new Date(submittedAt.getTime() + timeoutMs);
}

/** `expires_at` is the first instant at which the job is over, not the last one it may run. */
export function isOcrJobExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}
