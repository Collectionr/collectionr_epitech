import { DomainValidationError } from '../errors/DomainValidationError';
import { OCR_IMAGE_MIME_TYPES } from './OcrContract';
import {
  buildOcrImagePath,
  buildOcrResultPath,
  isOcrImagePathOf,
  isOcrJobId,
  ocrImagePathMatchesMimeType,
} from './OcrImagePath';

const JOB_ID = 'a3f8c1d2-4e56-7890-abcd-ef1234567890';

describe('isOcrJobId', () => {
  it('accepts a lower-case UUID', () => {
    expect(isOcrJobId(JOB_ID)).toBe(true);
  });

  it.each([JOB_ID.toUpperCase(), '', 'jobs', `${JOB_ID}/..`, `${JOB_ID}\n`, ' ' + JOB_ID])(
    'refuses %p',
    (value) => {
      expect(isOcrJobId(value)).toBe(false);
    },
  );
});

describe('buildOcrImagePath', () => {
  it.each([
    ['image/jpeg', `jobs/${JOB_ID}/input.jpg`],
    ['image/png', `jobs/${JOB_ID}/input.png`],
    ['image/webp', `jobs/${JOB_ID}/input.webp`],
  ] as const)('builds the path of a %s image', (mimeType, expected) => {
    expect(buildOcrImagePath(JOB_ID, mimeType)).toBe(expected);
  });

  it('refuses a job id that could escape the jobs folder', () => {
    expect(() => buildOcrImagePath('../secret', 'image/jpeg')).toThrow(DomainValidationError);
  });
});

describe('buildOcrResultPath', () => {
  it('puts the result file next to the image, in the folder of the job', () => {
    expect(buildOcrResultPath(JOB_ID)).toBe(`jobs/${JOB_ID}/result.json`);
  });

  it('refuses a job id that could escape the jobs folder', () => {
    expect(() => buildOcrResultPath('../secret')).toThrow(DomainValidationError);
  });
});

describe('isOcrImagePathOf', () => {
  it.each(OCR_IMAGE_MIME_TYPES)('accepts the path built for %s', (mimeType) => {
    expect(isOcrImagePathOf(JOB_ID, buildOcrImagePath(JOB_ID, mimeType))).toBe(true);
  });

  it.each([
    `jobs/${JOB_ID}/input.gif`,
    `jobs/${JOB_ID}/../input.jpg`,
    `/jobs/${JOB_ID}/input.jpg`,
    `jobs/${JOB_ID}/input.jpg/`,
    `jobs/${JOB_ID}/input.JPG`,
  ])('refuses %p', (path) => {
    expect(isOcrImagePathOf(JOB_ID, path)).toBe(false);
  });

  it('refuses everything when the job id itself is malformed', () => {
    expect(isOcrImagePathOf('x', 'jobs/x/input.jpg')).toBe(false);
  });
});

describe('ocrImagePathMatchesMimeType', () => {
  it('compares the extension with the mime type', () => {
    expect(ocrImagePathMatchesMimeType(`jobs/${JOB_ID}/input.png`, 'image/png')).toBe(true);
    expect(ocrImagePathMatchesMimeType(`jobs/${JOB_ID}/input.png`, 'image/jpeg')).toBe(false);
  });
});
