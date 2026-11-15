import { Type } from 'class-transformer';
import {
  Equals,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  OCR_ERROR_MESSAGE_MAX_LENGTH,
  OCR_JOB_ID_PATTERN,
  OCR_SCHEMA_VERSION,
  OCR_TIMESTAMP_ZONE_PATTERN,
} from '../../domain/rules/OcrContract';
import { OCR_WORKER_STATUSES } from '../../domain/value-objects/OcrJobStatus';
import type { OcrWorkerStatus } from '../../domain/value-objects/OcrJobStatus';
import { OCR_WORKER_FAILURE_CODES } from '../../domain/value-objects/OcrFailureCode';
import type { OcrWorkerFailureCode } from '../../domain/value-objects/OcrFailureCode';
import { OCR_MESSAGE_PATTERN } from './OcrTextPatterns';

export class OcrWorkerErrorDto {
  @IsIn(OCR_WORKER_FAILURE_CODES)
  code!: OcrWorkerFailureCode;

  @IsString()
  @MinLength(1)
  @MaxLength(OCR_ERROR_MESSAGE_MAX_LENGTH)
  @Matches(OCR_MESSAGE_PATTERN)
  message!: string;
}

/**
 * Wire format of a status event (worker -> backend), snake_case like the JSON. It never carries
 * the result: that is in the result file. `error` must be present for the `error` status and
 * absent otherwise; the codec checks it (a decorator on one property cannot express "required for
 * error, forbidden otherwise").
 */
export class OcrEventMessageDto {
  @Equals(OCR_SCHEMA_VERSION)
  schema_version!: number;

  @Matches(OCR_JOB_ID_PATTERN)
  job_id!: string;

  @IsIn(OCR_WORKER_STATUSES)
  status!: OcrWorkerStatus;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(OCR_TIMESTAMP_ZONE_PATTERN)
  emitted_at!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => OcrWorkerErrorDto)
  error?: OcrWorkerErrorDto | null;
}
