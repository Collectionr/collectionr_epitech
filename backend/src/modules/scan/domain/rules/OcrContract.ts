// Constants of the backend <-> OCR worker contract (COLLR-622). They are shared with the Data/AI
// team: changing one is a contract change (bump OCR_SCHEMA_VERSION and update
// docs/AI/workflow/contrat-backend-worker-ocr.md). Backend-only tuning lives in OcrPolicy.ts.

/** Carried by every message and file. A reader refuses any other value instead of guessing. */
export const OCR_SCHEMA_VERSION = 1;

// Redis stream names, consumer groups and trim lengths are deliberately absent: they belong to
// the Redis adapter of COLLR-420 and are to be confirmed by a real test, not fixed by the contract.

/**
 * Internal safety guard, not a contract term: the backend does not parse a worker document that is
 * far larger than anything the contract can produce (a few hundred bytes).
 */
export const OCR_MESSAGE_MAX_BYTES = 16_384;

/** Formats of the image handed to the worker (validated at POST /scan, COLLR-420). */
export const OCR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type OcrImageMimeType = (typeof OCR_IMAGE_MIME_TYPES)[number];

export const OCR_IMAGE_EXTENSIONS: Readonly<Record<OcrImageMimeType, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Layout of the Shared Volume (CDC §3.4.1: the worker writes its result as JSON there):
 * `<OCR_SHARED_DIR>/jobs/<job_id>/input.<ext>` is written by the backend,
 * `<OCR_SHARED_DIR>/jobs/<job_id>/result.json` by the worker.
 */
export const OCR_JOBS_DIRECTORY = 'jobs';
export const OCR_IMAGE_BASENAME = 'input';
export const OCR_RESULT_FILENAME = 'result.json';
/** The worker writes here first, then renames to OCR_RESULT_FILENAME, so a reader never sees half a file. */
export const OCR_RESULT_TEMP_FILENAME = 'result.json.tmp';

/** Canonical job identifier: a lower-case UUID, so the folder name is the same on every filesystem. */
export const OCR_JOB_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Timestamps are ISO 8601 with an explicit zone (`Z` or `+02:00`): a bare local time is ambiguous. */
export const OCR_TIMESTAMP_ZONE_PATTERN = /(Z|[+-]\d{2}:\d{2})$/;

/** Card languages of the V1 scope (CDC §3.4.1: French and English), same codes as a collection entry. */
export const OCR_LANGUAGES = ['fr', 'en'] as const;
export type OcrLanguage = (typeof OCR_LANGUAGES)[number];

/** Bounds of the text read off the card (and of the worker's own messages). */
export const OCR_CARD_NAME_MAX_LENGTH = 100;
export const OCR_SET_CODE_MAX_LENGTH = 20;
export const OCR_SET_NUMBER_MAX_LENGTH = 20;
export const OCR_RARITY_MAX_LENGTH = 50;
export const OCR_MODEL_VERSION_MAX_LENGTH = 64;
export const OCR_ERROR_MESSAGE_MAX_LENGTH = 200;
export const OCR_IMAGE_PATH_MAX_LENGTH = 200;

/** Upper bound of a plausible inference time (one hour); refuses absurd values, not slow ones. */
export const OCR_PROCESSING_MS_MAX = 3_600_000;
