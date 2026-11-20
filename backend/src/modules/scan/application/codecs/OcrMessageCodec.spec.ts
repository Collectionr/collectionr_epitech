import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { OcrEvent, OcrJobMessage, OcrResultFile } from '../../domain/entities/OcrMessages';
import { OCR_MESSAGE_MAX_BYTES } from '../../domain/rules/OcrContract';
import { OcrContractViolationError } from '../errors/OcrContractViolationError';
import {
  parseOcrEventMessage,
  parseOcrJobMessage,
  parseOcrResultFile,
  serializeOcrEventMessage,
  serializeOcrJobMessage,
  serializeOcrResultFile,
} from './OcrMessageCodec';

// The examples of the contract document are the fixtures: if the document and the code drift
// apart, this suite fails.
const EXAMPLES_DIRECTORY = join(
  __dirname,
  '../../../../../../docs/AI/workflow/exemples-contrat-ocr',
);

function example(name: string): string {
  return readFileSync(join(EXAMPLES_DIRECTORY, name), 'utf8');
}

function exampleObject(name: string): Record<string, unknown> {
  return JSON.parse(example(name)) as Record<string, unknown>;
}

function withChanges(name: string, changes: Record<string, unknown>): string {
  return JSON.stringify({ ...exampleObject(name), ...changes });
}

function withResult(changes: Record<string, unknown>): string {
  const base = exampleObject('result-file.json');
  return JSON.stringify({ ...base, result: { ...(base.result as object), ...changes } });
}

function reasonOf(result: { ok: boolean; reason?: string }): string {
  expect(result.ok).toBe(false);
  return result.reason ?? '';
}

const JOB_ID = 'a3f8c1d2-4e56-7890-abcd-ef1234567890';

describe('parseOcrJobMessage', () => {
  it('reads the documented example', () => {
    expect(parseOcrJobMessage(example('job.json'))).toEqual({
      ok: true,
      value: {
        jobId: JOB_ID,
        imagePath: `jobs/${JOB_ID}/input.jpg`,
        imageMimeType: 'image/jpeg',
        attempt: 1,
        submittedAt: new Date('2026-11-15T10:00:00.000Z'),
        expiresAt: new Date('2026-11-15T10:01:00.000Z'),
      },
    });
  });

  it.each([
    ['not JSON', 'not json'],
    ['an array', '[]'],
    ['null', 'null'],
    ['a number', '12'],
  ])('refuses %s', (_label, raw) => {
    expect(parseOcrJobMessage(raw).ok).toBe(false);
  });

  it('refuses an oversized message before parsing it', () => {
    const raw = JSON.stringify({ padding: 'x'.repeat(OCR_MESSAGE_MAX_BYTES) });

    expect(reasonOf(parseOcrJobMessage(raw))).toBe('message is too large');
  });

  it('refuses another schema version', () => {
    expect(reasonOf(parseOcrJobMessage(withChanges('job.json', { schema_version: 2 })))).toContain(
      'schema_version',
    );
  });

  it('refuses a job id that is not a lower-case UUID', () => {
    const upper = JOB_ID.toUpperCase();

    expect(reasonOf(parseOcrJobMessage(withChanges('job.json', { job_id: upper })))).toContain(
      'job_id',
    );
  });

  it.each([
    ['a traversal', '../../etc/passwd'],
    ['an absolute path', `/data/ocr/jobs/${JOB_ID}/input.jpg`],
    ['another job folder', 'jobs/00000000-0000-0000-0000-000000000000/input.jpg'],
    ['another file name', `jobs/${JOB_ID}/other.jpg`],
    ['an unsupported extension', `jobs/${JOB_ID}/input.gif`],
  ])('refuses an image path that is %s', (_label, imagePath) => {
    const raw = withChanges('job.json', { image_path: imagePath });

    expect(reasonOf(parseOcrJobMessage(raw))).toBe(
      'image_path does not match job_id and image_mime_type',
    );
  });

  it('refuses an image path whose extension contradicts the mime type', () => {
    const raw = withChanges('job.json', { image_mime_type: 'image/png' });

    expect(reasonOf(parseOcrJobMessage(raw))).toBe(
      'image_path does not match job_id and image_mime_type',
    );
  });

  it('refuses an unsupported mime type', () => {
    expect(
      reasonOf(parseOcrJobMessage(withChanges('job.json', { image_mime_type: 'image/gif' }))),
    ).toContain('image_mime_type');
  });

  it.each([0, 3, 1.5, '1'])('refuses the attempt number %p', (attempt) => {
    expect(reasonOf(parseOcrJobMessage(withChanges('job.json', { attempt })))).toContain('attempt');
  });

  it('refuses a timestamp without a time zone', () => {
    const raw = withChanges('job.json', { submitted_at: '2026-11-15T10:00:00' });

    expect(reasonOf(parseOcrJobMessage(raw))).toContain('submitted_at');
  });

  it('accepts a timestamp with an offset', () => {
    const raw = withChanges('job.json', {
      submitted_at: '2026-11-15T11:00:00+01:00',
      expires_at: '2026-11-15T11:01:00+01:00',
    });

    expect(parseOcrJobMessage(raw).ok).toBe(true);
  });

  it('refuses an expiry that is not after the submission', () => {
    const raw = withChanges('job.json', { expires_at: '2026-11-15T10:00:00.000Z' });

    expect(reasonOf(parseOcrJobMessage(raw))).toBe('expires_at must be after submitted_at');
  });

  it('refuses a field the contract does not define, naming it without its value', () => {
    const raw = withChanges('job.json', { user_id: 'user-123' });

    const reason = reasonOf(parseOcrJobMessage(raw));

    expect(reason).toContain('user_id');
    expect(reason).not.toContain('user-123');
  });
});

describe('serializeOcrJobMessage', () => {
  const message: OcrJobMessage = {
    jobId: JOB_ID,
    imagePath: `jobs/${JOB_ID}/input.jpg`,
    imageMimeType: 'image/jpeg',
    attempt: 1,
    submittedAt: new Date('2026-11-15T10:00:00.000Z'),
    expiresAt: new Date('2026-11-15T10:01:00.000Z'),
  };

  it('writes exactly the documented example', () => {
    expect(JSON.parse(serializeOcrJobMessage(message))).toEqual(exampleObject('job.json'));
  });

  it('round-trips through the parser', () => {
    expect(parseOcrJobMessage(serializeOcrJobMessage(message))).toEqual({
      ok: true,
      value: message,
    });
  });

  it('throws on a path that is not derived from the job id', () => {
    expect(() => serializeOcrJobMessage({ ...message, imagePath: 'jobs/x/input.jpg' })).toThrow(
      OcrContractViolationError,
    );
  });

  it('throws on an invalid date', () => {
    expect(() => serializeOcrJobMessage({ ...message, expiresAt: new Date('nope') })).toThrow(
      'invalid date',
    );
  });
});

describe('parseOcrEventMessage', () => {
  it('reads a processing event', () => {
    expect(parseOcrEventMessage(example('event-processing.json'))).toEqual({
      ok: true,
      value: {
        jobId: JOB_ID,
        status: 'processing',
        emittedAt: new Date('2026-11-15T10:00:01.200Z'),
      },
    });
  });

  it('reads a done event, which carries the status only', () => {
    expect(parseOcrEventMessage(example('event-done.json'))).toEqual({
      ok: true,
      value: {
        jobId: JOB_ID,
        status: 'done',
        emittedAt: new Date('2026-11-15T10:00:04.200Z'),
      },
    });
  });

  it('reads an error event', () => {
    expect(parseOcrEventMessage(example('event-error.json'))).toEqual({
      ok: true,
      value: {
        jobId: JOB_ID,
        status: 'error',
        emittedAt: new Date('2026-11-15T10:00:03.500Z'),
        error: { code: 'NO_CARD_DETECTED', message: 'No card found in the image' },
      },
    });
  });

  it.each([
    ['unknown status', { status: 'finished' }],
    ['pending, which only the backend decides', { status: 'pending' }],
    ['timeout, which only the backend decides', { status: 'timeout' }],
    ['another schema version', { schema_version: 2 }],
    ['a job id in capitals', { job_id: JOB_ID.toUpperCase() }],
    ['a date that does not exist', { emitted_at: '2026-02-30T10:00:00Z' }],
    ['an extra top-level field', { debug: true }],
    ['a result, which belongs in the result file', { result: { name: 'Pikachu' } }],
  ])('refuses %s', (_label, changes) => {
    expect(parseOcrEventMessage(withChanges('event-done.json', changes)).ok).toBe(false);
  });

  it('refuses an error code that is not a worker failure', () => {
    const raw = JSON.stringify({
      ...exampleObject('event-error.json'),
      error: { code: 'TIMEOUT', message: 'late' },
    });

    expect(reasonOf(parseOcrEventMessage(raw))).toContain('error.code');
  });

  it('refuses an error message with a control character', () => {
    const raw = JSON.stringify({
      ...exampleObject('event-error.json'),
      error: { code: 'INFERENCE_FAILED', message: 'line\nbreak' },
    });

    expect(reasonOf(parseOcrEventMessage(raw))).toContain('error.message');
  });

  describe('error must match the status', () => {
    const errorEvent = exampleObject('event-error.json');

    it.each([
      ['error without an error', withChanges('event-error.json', { error: undefined })],
      ['error with a null error', withChanges('event-error.json', { error: null })],
      ['done carrying an error', withChanges('event-done.json', { error: errorEvent.error })],
      [
        'processing carrying an error',
        withChanges('event-processing.json', { error: errorEvent.error }),
      ],
    ])('refuses %s', (_label, raw) => {
      expect(reasonOf(parseOcrEventMessage(raw))).toMatch(/error does not match status/);
    });

    it('accepts an explicit null error on a status that does not carry one', () => {
      const raw = withChanges('event-processing.json', { error: null });

      expect(parseOcrEventMessage(raw).ok).toBe(true);
    });
  });

  it('never throws, whatever it receives', () => {
    for (const raw of ['', '{', '"text"', 'true', '{"status":{"__proto__":1}}']) {
      expect(() => parseOcrEventMessage(raw)).not.toThrow();
    }
  });
});

describe('serializeOcrEventMessage', () => {
  const events: readonly [string, string, OcrEvent][] = [
    [
      'processing',
      'event-processing.json',
      { jobId: JOB_ID, status: 'processing', emittedAt: new Date('2026-11-15T10:00:01.200Z') },
    ],
    [
      'done',
      'event-done.json',
      { jobId: JOB_ID, status: 'done', emittedAt: new Date('2026-11-15T10:00:04.200Z') },
    ],
    [
      'error',
      'event-error.json',
      {
        jobId: JOB_ID,
        status: 'error',
        emittedAt: new Date('2026-11-15T10:00:03.500Z'),
        error: { code: 'NO_CARD_DETECTED', message: 'No card found in the image' },
      },
    ],
  ];

  it.each(events)('writes the documented %s example', (_status, file, event) => {
    expect(JSON.parse(serializeOcrEventMessage(event))).toEqual(exampleObject(file));
  });

  it.each(events)('round-trips a %s event through the parser', (_status, _file, event) => {
    expect(parseOcrEventMessage(serializeOcrEventMessage(event))).toEqual({
      ok: true,
      value: event,
    });
  });

  it('throws on an error code the contract refuses', () => {
    expect(() =>
      serializeOcrEventMessage({
        jobId: JOB_ID,
        status: 'error',
        emittedAt: new Date('2026-11-15T10:00:03.500Z'),
        error: { code: 'NO_CARD_DETECTED', message: '' },
      }),
    ).toThrow(OcrContractViolationError);
  });

  it('throws on an invalid date', () => {
    expect(() =>
      serializeOcrEventMessage({ jobId: JOB_ID, status: 'processing', emittedAt: new Date('x') }),
    ).toThrow('invalid date');
  });
});

describe('parseOcrResultFile', () => {
  it('reads the documented example', () => {
    expect(parseOcrResultFile(example('result-file.json'))).toEqual({
      ok: true,
      value: {
        jobId: JOB_ID,
        producedAt: new Date('2026-11-15T10:00:04.100Z'),
        result: {
          name: 'Funécire',
          setCode: 'TWM FR',
          setNumber: '036/167',
          language: 'fr',
          rarity: 'Common',
          confidence: 0.94,
          modelVersion: 'qwen2.5-vl-3b-1',
          processingMs: 2840,
        },
      },
    });
  });

  it('reads the fields the worker could not read as null', () => {
    const parsed = parseOcrResultFile(example('result-file-partial.json'));

    expect(parsed.ok && parsed.value.result).toMatchObject({
      name: 'Octillery',
      setCode: null,
      setNumber: 'TG03/TG30',
      language: null,
      rarity: null,
    });
  });

  it('accepts fields that are absent instead of null', () => {
    const base = exampleObject('result-file.json');
    const result = { ...(base.result as Record<string, unknown>) };
    delete result.set_code;
    delete result.language;
    delete result.rarity;

    const parsed = parseOcrResultFile(JSON.stringify({ ...base, result }));

    expect(parsed.ok && parsed.value.result).toMatchObject({
      setCode: null,
      language: null,
      rarity: null,
    });
  });

  it('accepts a result where nothing was read (the backend classifies it later)', () => {
    const raw = withResult({
      name: null,
      set_code: null,
      set_number: null,
      language: null,
      rarity: null,
      confidence: 0.1,
    });

    expect(parseOcrResultFile(raw).ok).toBe(true);
  });

  it.each([
    ['another schema version', { schema_version: 2 }],
    ['a job id in capitals', { job_id: JOB_ID.toUpperCase() }],
    ['a date without a time zone', { produced_at: '2026-11-15T10:00:04' }],
    ['no result', { result: undefined }],
    ['a null result', { result: null }],
    ['a result that is not an object', { result: 'Pikachu' }],
    ['an extra top-level field', { debug: true }],
  ])('refuses a file with %s', (_label, changes) => {
    expect(parseOcrResultFile(withChanges('result-file.json', changes)).ok).toBe(false);
  });

  it.each([
    ['a confidence above 1', { confidence: 1.2 }],
    ['a negative confidence', { confidence: -0.1 }],
    ['a confidence that is a string', { confidence: '0.9' }],
    ['a language the V1 does not cover', { language: 'de' }],
    ['a language in capitals', { language: 'FR' }],
    ['a name that is too long', { name: 'x'.repeat(101) }],
    ['an empty name', { name: '' }],
    ['a name made of spaces', { name: '   ' }],
    ['a name with a control character', { name: 'Pika\u0000chu' }],
    ['a name with an invisible character', { name: 'Pika​chu' }],
    ['a name that is not text', { name: 42 }],
    ['a rarity that is too long', { rarity: 'x'.repeat(51) }],
    ['a negative processing time', { processing_ms: -1 }],
    ['a fractional processing time', { processing_ms: 12.5 }],
    ['a missing model version', { model_version: undefined }],
    ['an extra result field', { hp: 60 }],
  ])('refuses a result with %s', (_label, changes) => {
    expect(parseOcrResultFile(withResult(changes)).ok).toBe(false);
  });

  it('names the nested field that is wrong, without its value', () => {
    const reason = reasonOf(parseOcrResultFile(withResult({ confidence: 'secret-value' })));

    expect(reason).toBe('invalid field(s): result.confidence');
  });

  it('refuses an oversized file before parsing it', () => {
    const raw = JSON.stringify({ padding: 'x'.repeat(OCR_MESSAGE_MAX_BYTES) });

    expect(reasonOf(parseOcrResultFile(raw))).toBe('message is too large');
  });

  it('never throws, whatever it receives', () => {
    for (const raw of ['', '{', '"text"', 'true', '{"result":{"__proto__":1}}']) {
      expect(() => parseOcrResultFile(raw)).not.toThrow();
    }
  });
});

describe('serializeOcrResultFile', () => {
  const file: OcrResultFile = {
    jobId: JOB_ID,
    producedAt: new Date('2026-11-15T10:00:04.100Z'),
    result: {
      name: 'Funécire',
      setCode: 'TWM FR',
      setNumber: '036/167',
      language: 'fr',
      rarity: 'Common',
      confidence: 0.94,
      modelVersion: 'qwen2.5-vl-3b-1',
      processingMs: 2840,
    },
  };

  it('writes exactly the documented example', () => {
    expect(JSON.parse(serializeOcrResultFile(file))).toEqual(exampleObject('result-file.json'));
  });

  it('round-trips through the parser', () => {
    expect(parseOcrResultFile(serializeOcrResultFile(file))).toEqual({ ok: true, value: file });
  });

  it('throws on a result the contract refuses', () => {
    expect(() =>
      serializeOcrResultFile({ ...file, result: { ...file.result, confidence: 2 } }),
    ).toThrow(OcrContractViolationError);
  });

  it('throws on an invalid date', () => {
    expect(() => serializeOcrResultFile({ ...file, producedAt: new Date('x') })).toThrow(
      'invalid date',
    );
  });
});
