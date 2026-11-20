/**
 * Life cycle of a scan as the backend tracks it. The worker only ever emits `processing`, `done`
 * and `error`; `pending` (queued, nothing heard yet) and `timeout` (no final answer before
 * `expires_at`) are decided by the backend.
 */
export const OCR_JOB_STATUSES = ['pending', 'processing', 'done', 'error', 'timeout'] as const;
export type OcrJobStatus = (typeof OCR_JOB_STATUSES)[number];

/** Statuses a worker may put in an event. */
export const OCR_WORKER_STATUSES = ['processing', 'done', 'error'] as const;
export type OcrWorkerStatus = (typeof OCR_WORKER_STATUSES)[number];

const TRANSITIONS: Readonly<Record<OcrJobStatus, readonly OcrJobStatus[]>> = {
  // A fast worker may answer `done` or `error` without a `processing` event first.
  pending: ['processing', 'done', 'error', 'timeout'],
  processing: ['done', 'error', 'timeout'],
  done: [],
  error: [],
  timeout: [],
};

export function isTerminalOcrStatus(status: OcrJobStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

/**
 * Whether an event moving a scan from `from` to `to` must be applied. Anything else (a redelivered
 * `processing`, a `done` that arrives after the timeout was declared) is acknowledged and ignored:
 * the stream is at-least-once and a final status is never rewritten.
 */
export function canTransitionOcrStatus(from: OcrJobStatus, to: OcrJobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
