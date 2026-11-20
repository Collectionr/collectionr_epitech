import { OCR_FAILURES } from '../value-objects/OcrFailureCode';
import type { OcrFailureCode } from '../value-objects/OcrFailureCode';
import { OCR_MAX_ATTEMPTS } from './OcrPolicy';
import { shouldRetryOcrJob } from './OcrRetryPolicy';

const failureCodes = Object.keys(OCR_FAILURES) as OcrFailureCode[];
const retryable = failureCodes.filter((code) => OCR_FAILURES[code].retryable);
const final = failureCodes.filter((code) => !OCR_FAILURES[code].retryable);

describe('shouldRetryOcrJob', () => {
  it('only retries the failures that can be transient', () => {
    expect(retryable.sort()).toEqual(['INFERENCE_FAILED', 'MODEL_UNAVAILABLE']);
  });

  it.each(retryable)('retries %s after the first attempt', (code) => {
    expect(shouldRetryOcrJob(code, 1)).toBe(true);
  });

  it.each(retryable)('stops retrying %s once the attempts are used up', (code) => {
    expect(shouldRetryOcrJob(code, OCR_MAX_ATTEMPTS)).toBe(false);
  });

  it.each(final)('never retries %s', (code) => {
    expect(shouldRetryOcrJob(code, 1)).toBe(false);
  });

  it('blames the image for the two failures a new photo can fix', () => {
    const imageCauses = failureCodes.filter((code) => OCR_FAILURES[code].cause === 'image');

    expect(imageCauses.sort()).toEqual(['IMAGE_UNREADABLE', 'NO_CARD_DETECTED']);
  });
});
