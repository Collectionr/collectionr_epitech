import { canTransitionOcrStatus, isTerminalOcrStatus, OCR_JOB_STATUSES } from './OcrJobStatus';
import type { OcrJobStatus } from './OcrJobStatus';

describe('OcrJobStatus', () => {
  it.each(['done', 'error', 'timeout'] as const)('%s is final', (status) => {
    expect(isTerminalOcrStatus(status)).toBe(true);
  });

  it.each(['pending', 'processing'] as const)('%s is not final', (status) => {
    expect(isTerminalOcrStatus(status)).toBe(false);
  });

  it.each([
    ['pending', 'processing'],
    ['pending', 'done'],
    ['pending', 'error'],
    ['pending', 'timeout'],
    ['processing', 'done'],
    ['processing', 'error'],
    ['processing', 'timeout'],
  ] as const)('moves from %s to %s', (from, to) => {
    expect(canTransitionOcrStatus(from, to)).toBe(true);
  });

  it.each(OCR_JOB_STATUSES)('never leaves a final status (%s -> anything)', (target) => {
    for (const final of ['done', 'error', 'timeout'] as const) {
      expect(canTransitionOcrStatus(final, target)).toBe(false);
    }
  });

  it('ignores a redelivered processing event', () => {
    expect(canTransitionOcrStatus('processing', 'processing')).toBe(false);
  });

  it('never goes back to pending', () => {
    const others: OcrJobStatus[] = ['processing', 'done', 'error', 'timeout'];

    for (const from of others) {
      expect(canTransitionOcrStatus(from, 'pending')).toBe(false);
    }
  });
});
