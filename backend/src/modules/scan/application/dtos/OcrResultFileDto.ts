import { Type } from 'class-transformer';
import { Equals, IsDefined, IsISO8601, Matches, ValidateNested } from 'class-validator';
import {
  OCR_JOB_ID_PATTERN,
  OCR_SCHEMA_VERSION,
  OCR_TIMESTAMP_ZONE_PATTERN,
} from '../../domain/rules/OcrContract';
import { OcrCardResultDto } from './OcrCardResultDto';

/**
 * Wire format of `jobs/<job_id>/result.json` (worker -> backend, CDC §3.4.1), snake_case like the
 * JSON. The file belongs to a job: its `job_id` is checked against the folder it was read from.
 */
export class OcrResultFileDto {
  @Equals(OCR_SCHEMA_VERSION)
  schema_version!: number;

  @Matches(OCR_JOB_ID_PATTERN)
  job_id!: string;

  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(OCR_TIMESTAMP_ZONE_PATTERN)
  produced_at!: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => OcrCardResultDto)
  result!: OcrCardResultDto;
}
