import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { ValidationError } from 'class-validator';
import type {
  OcrCardResult,
  OcrEvent,
  OcrJobMessage,
  OcrResultFile,
} from '../../domain/entities/OcrMessages';
import { OCR_MESSAGE_MAX_BYTES, OCR_SCHEMA_VERSION } from '../../domain/rules/OcrContract';
import { isOcrImagePathOf, ocrImagePathMatchesMimeType } from '../../domain/rules/OcrImagePath';
import { OcrContractViolationError } from '../errors/OcrContractViolationError';
import type { OcrCardResultDto } from '../dtos/OcrCardResultDto';
import { OcrEventMessageDto } from '../dtos/OcrEventMessageDto';
import { OcrJobMessageDto } from '../dtos/OcrJobMessageDto';
import { OcrResultFileDto } from '../dtos/OcrResultFileDto';

/**
 * Reads and writes the three JSON documents of the backend <-> OCR worker contract
 * (docs/AI/workflow/contrat-backend-worker-ocr.md): the job and the status events (Redis), and the
 * result file (Shared Volume). Everything the worker produced is untrusted: a `parse*` function
 * never throws and never echoes a received value, it answers `{ ok: false, reason }` where the
 * reason only names the offending fields. A `serialize*` function validates what is about to be
 * written and throws on a bug of the caller.
 */
export type OcrParseResult<T> =
  { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: string };

type Constructor<T> = new () => T;
type WireObject = Record<string, unknown>;

const MAX_REPORTED_FIELDS = 10;

function fail<T>(reason: string): OcrParseResult<T> {
  return { ok: false, reason };
}

// Field names come from the peer (an unknown key is reported by its name): keep them harmless.
function sanitizeFieldName(path: string): string {
  return path.replace(/[^A-Za-z0-9_.]/g, '?').slice(0, 60);
}

function violationPaths(errors: readonly ValidationError[], prefix = ''): string[] {
  return errors.flatMap((error) => {
    const path = prefix === '' ? error.property : `${prefix}.${error.property}`;
    const own = error.constraints === undefined ? [] : [path];
    return [...own, ...violationPaths(error.children ?? [], path)];
  });
}

function validateWire<T extends object>(type: Constructor<T>, wire: WireObject): OcrParseResult<T> {
  const instance = plainToInstance(type, wire);
  const errors = validateSync(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  });
  if (errors.length === 0) {
    return { ok: true, value: instance };
  }
  const fields = violationPaths(errors).slice(0, MAX_REPORTED_FIELDS).map(sanitizeFieldName);
  return fail(`invalid field(s): ${fields.join(', ')}`);
}

function readJsonObject(raw: string): OcrParseResult<WireObject> {
  if (Buffer.byteLength(raw, 'utf8') > OCR_MESSAGE_MAX_BYTES) {
    return fail('message is too large');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail('message is not valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return fail('message is not a JSON object');
  }
  return { ok: true, value: parsed as WireObject };
}

function present<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

// ---------------------------------------------------------------------------------------------
// Job (backend -> worker, Redis)
// ---------------------------------------------------------------------------------------------

function readJobWire(wire: WireObject): OcrParseResult<OcrJobMessage> {
  const checked = validateWire(OcrJobMessageDto, wire);
  if (!checked.ok) {
    return fail(checked.reason);
  }
  const dto = checked.value;
  // The path is derived from the job id and the format: a worker must never open a path that is
  // not exactly that one, whatever the message says.
  if (
    !isOcrImagePathOf(dto.job_id, dto.image_path) ||
    !ocrImagePathMatchesMimeType(dto.image_path, dto.image_mime_type)
  ) {
    return fail('image_path does not match job_id and image_mime_type');
  }
  const submittedAt = new Date(dto.submitted_at);
  const expiresAt = new Date(dto.expires_at);
  if (expiresAt.getTime() <= submittedAt.getTime()) {
    return fail('expires_at must be after submitted_at');
  }
  return {
    ok: true,
    value: {
      jobId: dto.job_id,
      imagePath: dto.image_path,
      imageMimeType: dto.image_mime_type,
      attempt: dto.attempt,
      submittedAt,
      expiresAt,
    },
  };
}

export function parseOcrJobMessage(raw: string): OcrParseResult<OcrJobMessage> {
  const json = readJsonObject(raw);
  return json.ok ? readJobWire(json.value) : fail(json.reason);
}

export function serializeOcrJobMessage(message: OcrJobMessage): string {
  if (!isValidDate(message.submittedAt) || !isValidDate(message.expiresAt)) {
    throw new OcrContractViolationError('OCR job message: invalid date');
  }
  const wire: WireObject = {
    schema_version: OCR_SCHEMA_VERSION,
    job_id: message.jobId,
    image_path: message.imagePath,
    image_mime_type: message.imageMimeType,
    attempt: message.attempt,
    submitted_at: message.submittedAt.toISOString(),
    expires_at: message.expiresAt.toISOString(),
  };
  const checked = readJobWire(wire);
  if (!checked.ok) {
    throw new OcrContractViolationError(`OCR job message: ${checked.reason}`);
  }
  return JSON.stringify(wire);
}

// ---------------------------------------------------------------------------------------------
// Status event (worker -> backend, Redis)
// ---------------------------------------------------------------------------------------------

function readEventWire(wire: WireObject): OcrParseResult<OcrEvent> {
  const checked = validateWire(OcrEventMessageDto, wire);
  if (!checked.ok) {
    return fail(checked.reason);
  }
  const dto = checked.value;
  const base = { jobId: dto.job_id, emittedAt: new Date(dto.emitted_at) };
  const { error } = dto;

  // `error` goes with the `error` status and with nothing else; a message carrying it on another
  // status (or missing it on `error`) is ambiguous, so it is refused rather than interpreted.
  if (dto.status === 'error' && present(error)) {
    return {
      ok: true,
      value: { ...base, status: 'error', error: { code: error.code, message: error.message } },
    };
  }
  if (dto.status !== 'error' && !present(error)) {
    return { ok: true, value: { ...base, status: dto.status } };
  }
  return fail(`error does not match status "${dto.status}"`);
}

export function parseOcrEventMessage(raw: string): OcrParseResult<OcrEvent> {
  const json = readJsonObject(raw);
  return json.ok ? readEventWire(json.value) : fail(json.reason);
}

function eventToWire(event: OcrEvent): WireObject {
  const wire: WireObject = {
    schema_version: OCR_SCHEMA_VERSION,
    job_id: event.jobId,
    status: event.status,
    emitted_at: event.emittedAt.toISOString(),
  };
  if (event.status === 'error') {
    wire.error = { code: event.error.code, message: event.error.message };
  }
  return wire;
}

/**
 * Writes an event the way a worker does. The backend never sends one; this exists for the Worker
 * OCR test double (COLLR-623 tests with a mocked worker) and keeps both ends on the same codec.
 */
export function serializeOcrEventMessage(event: OcrEvent): string {
  if (!isValidDate(event.emittedAt)) {
    throw new OcrContractViolationError('OCR event message: invalid date');
  }
  const wire = eventToWire(event);
  const checked = readEventWire(wire);
  if (!checked.ok) {
    throw new OcrContractViolationError(`OCR event message: ${checked.reason}`);
  }
  return JSON.stringify(wire);
}

// ---------------------------------------------------------------------------------------------
// Result file (worker -> backend, Shared Volume)
// ---------------------------------------------------------------------------------------------

function mapResult(dto: OcrCardResultDto): OcrCardResult {
  return {
    name: dto.name ?? null,
    setCode: dto.set_code ?? null,
    setNumber: dto.set_number ?? null,
    language: dto.language ?? null,
    rarity: dto.rarity ?? null,
    confidence: dto.confidence,
    modelVersion: dto.model_version,
    processingMs: dto.processing_ms,
  };
}

function readResultFileWire(wire: WireObject): OcrParseResult<OcrResultFile> {
  const checked = validateWire(OcrResultFileDto, wire);
  if (!checked.ok) {
    return fail(checked.reason);
  }
  const dto = checked.value;
  return {
    ok: true,
    value: {
      jobId: dto.job_id,
      producedAt: new Date(dto.produced_at),
      result: mapResult(dto.result),
    },
  };
}

/**
 * Reads the content of `result.json`. The caller compares the returned `jobId` with the folder the
 * file was read from: a file that belongs to another job must not be applied to this one.
 */
export function parseOcrResultFile(raw: string): OcrParseResult<OcrResultFile> {
  const json = readJsonObject(raw);
  return json.ok ? readResultFileWire(json.value) : fail(json.reason);
}

function resultFileToWire(file: OcrResultFile): WireObject {
  return {
    schema_version: OCR_SCHEMA_VERSION,
    job_id: file.jobId,
    produced_at: file.producedAt.toISOString(),
    result: {
      name: file.result.name,
      set_code: file.result.setCode,
      set_number: file.result.setNumber,
      language: file.result.language,
      rarity: file.result.rarity,
      confidence: file.result.confidence,
      model_version: file.result.modelVersion,
      processing_ms: file.result.processingMs,
    },
  };
}

/**
 * Writes a result file the way a worker does, for the Worker OCR test double (the backend never
 * writes one). Keeps both ends on the same codec.
 */
export function serializeOcrResultFile(file: OcrResultFile): string {
  if (!isValidDate(file.producedAt)) {
    throw new OcrContractViolationError('OCR result file: invalid date');
  }
  const wire = resultFileToWire(file);
  const checked = readResultFileWire(wire);
  if (!checked.ok) {
    throw new OcrContractViolationError(`OCR result file: ${checked.reason}`);
  }
  return JSON.stringify(wire);
}
