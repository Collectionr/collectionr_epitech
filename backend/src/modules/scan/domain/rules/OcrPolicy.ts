// Backend-side OCR policy (COLLR-626). Unlike OcrContract.ts, none of these values is read by the
// worker: they are product/operations decisions, kept in one place so that tuning one is a
// one-line edit. They do not vary per environment, hence constants and not environment variables.

/**
 * Time budget of a whole scan, queue wait and cold start included. The SLA is an inference under
 * 4 s for one card and under 15 s for a batch of 9 (CDC §4.2, Document QA §6.1); this is the point
 * where the backend gives up and tells the user, not the SLA itself (D04 measures that). 30 s is
 * twice the batch SLA. Provisional: the OCR model is not chosen yet (Gestion des Risques RT-16).
 */
export const OCR_JOB_TIMEOUT_MS = 30_000;

/** Total tries of one scan (first attempt included). A retry only follows a retryable failure. */
export const OCR_MAX_ATTEMPTS = 2;

/**
 * Confidence at or above which a result is proposed as a likely match. The CDC asks for "un seuil
 * de confiance minimal" without a figure (§3.4.1); the model evaluation requires an exact match of
 * 0.80 on the critical fields (evaluation.md §9), 0.85 keeps a margin above that bar. Provisional
 * until the chosen model's score distribution is measured.
 */
export const OCR_CONFIDENCE_HIGH = 0.85;

/**
 * Confidence below which the card is reported as not identified and a manual confirmation is
 * offered instead (CDC §3.4.1, Document QA §17.2: manual intervention rather than a wrong
 * automatic validation). Provisional, same reason as above.
 */
export const OCR_CONFIDENCE_LOW = 0.5;

/**
 * How long after `expires_at` the backend waits before deleting the folder of a job the worker
 * never cleaned up (crashed worker). The worker deletes the input image in the normal flow, the
 * backend deletes the result file after reading it.
 */
export const OCR_ORPHAN_IMAGE_GRACE_MS = 300_000;
