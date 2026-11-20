import {
  Equals,
  IsIn,
  IsInt,
  IsISO8601,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import {
  OCR_IMAGE_MIME_TYPES,
  OCR_IMAGE_PATH_MAX_LENGTH,
  OCR_JOB_ID_PATTERN,
  OCR_SCHEMA_VERSION,
  OCR_TIMESTAMP_ZONE_PATTERN,
} from '../../domain/rules/OcrContract';
import type { OcrImageMimeType } from '../../domain/rules/OcrContract';
import { OCR_MAX_ATTEMPTS } from '../../domain/rules/OcrPolicy';

/**
 * Wire format of a job (backend -> worker). Property names are the JSON keys, hence snake_case:
 * that is what the Python worker reads (docs/AI/workflow/contrat-backend-worker-ocr.md).
 * Cross-field rules (path derived from the job id, expiry after submission) are checked by the
 * codec; these decorators only cover each field on its own.
 */
export class OcrJobMessageDto {
  @Equals(OCR_SCHEMA_VERSION)
  schema_version!: number;

  @Matches(OCR_JOB_ID_PATTERN)
  job_id!: string;

  @IsString()
  @MaxLength(OCR_IMAGE_PATH_MAX_LENGTH)
  image_path!: string;

  @IsIn(OCR_IMAGE_MIME_TYPES)
  image_mime_type!: OcrImageMimeType;

  @IsInt()
  @Min(1)
  @Max(OCR_MAX_ATTEMPTS)
  attempt!: number;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(OCR_TIMESTAMP_ZONE_PATTERN)
  submitted_at!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(OCR_TIMESTAMP_ZONE_PATTERN)
  expires_at!: string;
}
