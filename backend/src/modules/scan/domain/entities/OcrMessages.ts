import type { OcrImageMimeType, OcrLanguage } from '../rules/OcrContract';
import type { OcrWorkerFailureCode } from '../value-objects/OcrFailureCode';

// Domain view (camelCase, real dates) of what is exchanged with the worker. On the wire it is
// snake_case JSON; application/codecs/OcrMessageCodec.ts converts and validates. Three things
// travel: the job (Redis), the status events (Redis) and the result file (Shared Volume).

/** Backend -> worker, on the `ocr:jobs` stream. Carries no user data: the worker does not need it. */
export interface OcrJobMessage {
  readonly jobId: string;
  /** Relative to the Shared Volume root, see buildOcrImagePath. */
  readonly imagePath: string;
  readonly imageMimeType: OcrImageMimeType;
  /** 1 for the first try, then 2... up to OCR_MAX_ATTEMPTS. */
  readonly attempt: number;
  readonly submittedAt: Date;
  readonly expiresAt: Date;
}

/** What the worker read off the card. Every field but the score is nullable: unreadable is not an error. */
export interface OcrCardResult {
  readonly name: string | null;
  /** Set code as printed (e.g. `TWM FR`), not the catalogue identifier. */
  readonly setCode: string | null;
  /** Number as printed (e.g. `036/167`, `TG03/TG30`), zeros and prefixes kept. */
  readonly setNumber: string | null;
  /** Language of the card, detected by the model (CDC §3.4.1); used to look up the right price. */
  readonly language: OcrLanguage | null;
  /** Rarity as printed or read, free text (CDC §3.4.1 lists it); the catalogue uses its own codes. */
  readonly rarity: string | null;
  /** Overall score from 0 (a guess) to 1 (certain), see classifyOcrResult. */
  readonly confidence: number;
  readonly modelVersion: string;
  readonly processingMs: number;
}

/** Worker -> backend, in `jobs/<job_id>/result.json` on the Shared Volume. */
export interface OcrResultFile {
  readonly jobId: string;
  readonly producedAt: Date;
  readonly result: OcrCardResult;
}

export interface OcrWorkerError {
  readonly code: OcrWorkerFailureCode;
  /** For logs only: no path, no user data. The user-facing wording depends on the code. */
  readonly message: string;
}

interface OcrEventBase {
  readonly jobId: string;
  readonly emittedAt: Date;
}

/**
 * Worker -> backend, on the `ocr:events` stream. Status only: the result of a `done` job is in the
 * result file, written before the event is published. `error` iff the status is `error`.
 */
export type OcrEvent =
  | (OcrEventBase & { readonly status: 'processing' })
  | (OcrEventBase & { readonly status: 'done' })
  | (OcrEventBase & { readonly status: 'error'; readonly error: OcrWorkerError });
