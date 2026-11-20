import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  OCR_CARD_NAME_MAX_LENGTH,
  OCR_LANGUAGES,
  OCR_MODEL_VERSION_MAX_LENGTH,
  OCR_PROCESSING_MS_MAX,
  OCR_RARITY_MAX_LENGTH,
  OCR_SET_CODE_MAX_LENGTH,
  OCR_SET_NUMBER_MAX_LENGTH,
} from '../../domain/rules/OcrContract';
import type { OcrLanguage } from '../../domain/rules/OcrContract';
import { OCR_TEXT_PATTERN } from './OcrTextPatterns';

/**
 * What the worker read off the card, in snake_case like the JSON of `result.json`. Every card field
 * is absent or `null` when the worker could not read it.
 */
export class OcrCardResultDto {
  @IsOptional()
  @IsString()
  @MaxLength(OCR_CARD_NAME_MAX_LENGTH)
  @Matches(OCR_TEXT_PATTERN)
  name?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(OCR_SET_CODE_MAX_LENGTH)
  @Matches(OCR_TEXT_PATTERN)
  set_code?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(OCR_SET_NUMBER_MAX_LENGTH)
  @Matches(OCR_TEXT_PATTERN)
  set_number?: string | null;

  @IsOptional()
  @IsIn(OCR_LANGUAGES)
  language?: OcrLanguage | null;

  @IsOptional()
  @IsString()
  @MaxLength(OCR_RARITY_MAX_LENGTH)
  @Matches(OCR_TEXT_PATTERN)
  rarity?: string | null;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(1)
  confidence!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(OCR_MODEL_VERSION_MAX_LENGTH)
  @Matches(OCR_TEXT_PATTERN)
  model_version!: string;

  @IsInt()
  @Min(0)
  @Max(OCR_PROCESSING_MS_MAX)
  processing_ms!: number;
}
