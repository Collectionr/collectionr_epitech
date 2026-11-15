import { DomainValidationError } from '../errors/DomainValidationError';
import {
  OCR_IMAGE_BASENAME,
  OCR_IMAGE_EXTENSIONS,
  OCR_IMAGE_MIME_TYPES,
  OCR_JOBS_DIRECTORY,
  OCR_JOB_ID_PATTERN,
  OCR_RESULT_FILENAME,
} from './OcrContract';
import type { OcrImageMimeType } from './OcrContract';

export function isOcrJobId(value: string): boolean {
  return OCR_JOB_ID_PATTERN.test(value);
}

/**
 * Path of a job's image, relative to the Shared Volume root. It is derived from the job id and the
 * format, never from anything the client sent (no file name, no traversal): the folder is the job.
 */
export function buildOcrImagePath(jobId: string, mimeType: OcrImageMimeType): string {
  if (!isOcrJobId(jobId)) {
    throw new DomainValidationError('OCR job id must be a lower-case UUID');
  }
  return `${OCR_JOBS_DIRECTORY}/${jobId}/${OCR_IMAGE_BASENAME}.${OCR_IMAGE_EXTENSIONS[mimeType]}`;
}

/** Whether `path` is exactly the path buildOcrImagePath gives for `jobId` and one accepted format. */
export function isOcrImagePathOf(jobId: string, path: string): boolean {
  if (!isOcrJobId(jobId)) {
    return false;
  }
  return OCR_IMAGE_MIME_TYPES.some((mimeType) => buildOcrImagePath(jobId, mimeType) === path);
}

/**
 * Path of the result file the worker writes for a job, relative to the Shared Volume root. Derived
 * from the job id only, like the image: the backend never reads a path the worker chose.
 */
export function buildOcrResultPath(jobId: string): string {
  if (!isOcrJobId(jobId)) {
    throw new DomainValidationError('OCR job id must be a lower-case UUID');
  }
  return `${OCR_JOBS_DIRECTORY}/${jobId}/${OCR_RESULT_FILENAME}`;
}

/** Whether the extension of `path` is the one that goes with `mimeType`. */
export function ocrImagePathMatchesMimeType(path: string, mimeType: OcrImageMimeType): boolean {
  return path.endsWith(`.${OCR_IMAGE_EXTENSIONS[mimeType]}`);
}
