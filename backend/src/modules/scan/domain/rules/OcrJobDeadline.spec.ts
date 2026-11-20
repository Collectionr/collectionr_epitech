import { computeOcrExpiresAt, isOcrJobExpired } from './OcrJobDeadline';
import { OCR_JOB_TIMEOUT_MS } from './OcrPolicy';

const submittedAt = new Date('2026-11-15T10:00:00.000Z');

describe('computeOcrExpiresAt', () => {
  it('adds the timeout budget to the submission time', () => {
    expect(computeOcrExpiresAt(submittedAt).getTime()).toBe(
      submittedAt.getTime() + OCR_JOB_TIMEOUT_MS,
    );
  });

  it('accepts another budget', () => {
    expect(computeOcrExpiresAt(submittedAt, 5000)).toEqual(new Date('2026-11-15T10:00:05.000Z'));
  });

  it('does not modify the date it is given', () => {
    computeOcrExpiresAt(submittedAt);

    expect(submittedAt).toEqual(new Date('2026-11-15T10:00:00.000Z'));
  });
});

describe('isOcrJobExpired', () => {
  const expiresAt = new Date('2026-11-15T10:01:00.000Z');

  it('is false before the expiry', () => {
    expect(isOcrJobExpired(expiresAt, new Date('2026-11-15T10:00:59.999Z'))).toBe(false);
  });

  it('is true at the expiry instant', () => {
    expect(isOcrJobExpired(expiresAt, expiresAt)).toBe(true);
  });

  it('is true after the expiry', () => {
    expect(isOcrJobExpired(expiresAt, new Date('2026-11-15T10:01:00.001Z'))).toBe(true);
  });
});
