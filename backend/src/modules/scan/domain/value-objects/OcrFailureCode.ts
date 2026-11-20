/** Failures a worker reports in an `error` event. */
export const OCR_WORKER_FAILURE_CODES = [
  'INVALID_JOB',
  'IMAGE_NOT_FOUND',
  'IMAGE_UNREADABLE',
  'NO_CARD_DETECTED',
  'JOB_EXPIRED',
  'MODEL_UNAVAILABLE',
  'INFERENCE_FAILED',
] as const;
export type OcrWorkerFailureCode = (typeof OCR_WORKER_FAILURE_CODES)[number];

/** Failures only the backend can observe. */
export const OCR_BACKEND_FAILURE_CODES = ['TIMEOUT', 'INVALID_EVENT', 'INVALID_RESULT'] as const;
export type OcrBackendFailureCode = (typeof OCR_BACKEND_FAILURE_CODES)[number];

export type OcrFailureCode = OcrWorkerFailureCode | OcrBackendFailureCode;

/**
 * `image`: the photo is the problem, scanning again with a better one can work.
 * `system`: nothing the user did wrong; the answer is "try again later".
 */
export type OcrFailureCause = 'image' | 'system';

export interface OcrFailureProfile {
  readonly cause: OcrFailureCause;
  /** Whether the same job may be queued again. Decided here, not by the worker, so it cannot drift. */
  readonly retryable: boolean;
}

export const OCR_FAILURES: Readonly<Record<OcrFailureCode, OcrFailureProfile>> = {
  /** The job message broke the contract: a backend bug, the same message would fail again. */
  INVALID_JOB: { cause: 'system', retryable: false },
  /** The backend writes the image before queueing, so a missing file is not a transient state. */
  IMAGE_NOT_FOUND: { cause: 'system', retryable: false },
  IMAGE_UNREADABLE: { cause: 'image', retryable: false },
  NO_CARD_DETECTED: { cause: 'image', retryable: false },
  /** The worker picked the job up after `expires_at`; the user has already been told it timed out. */
  JOB_EXPIRED: { cause: 'system', retryable: false },
  MODEL_UNAVAILABLE: { cause: 'system', retryable: true },
  INFERENCE_FAILED: { cause: 'system', retryable: true },
  /** No answer in time: the worker is probably down, queueing again would only make the user wait more. */
  TIMEOUT: { cause: 'system', retryable: false },
  /** The worker answered something that breaks the contract: a bug on its side, not worth a retry. */
  INVALID_EVENT: { cause: 'system', retryable: false },
  /** `done` was announced but the result file is missing or breaks the contract: same, a worker bug. */
  INVALID_RESULT: { cause: 'system', retryable: false },
};
