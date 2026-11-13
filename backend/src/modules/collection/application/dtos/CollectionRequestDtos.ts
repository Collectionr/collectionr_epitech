import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CARD_CONDITIONS } from '../../domain/value-objects/CardCondition';
import { CARD_LANGUAGES } from '../../domain/value-objects/CardLanguage';

// Upper bounds only refuse absurd payloads before they cost anything. The domain stays the
// authority on every rule (name 1-60, quantity 1-9999, notes 500, grade 0-10 with one decimal...):
// it answers with a precise 400, these decorators are the cheap static first line of defence.
const NAME_PAYLOAD_MAX_LENGTH = 200;
const NOTES_PAYLOAD_MAX_LENGTH = 2000;

export class CreateCollectionDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Licence of the collection (e.g. Pokémon). Fixed at creation.',
  })
  @IsUUID()
  licenceTCGId!: string;

  @ApiProperty({ example: 'Ma collection Écarlate et Violet', minLength: 1, maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_PAYLOAD_MAX_LENGTH)
  name!: string;
}

export class UpdateCollectionDto {
  @ApiProperty({ example: 'Doubles à échanger', minLength: 1, maxLength: 60 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(NAME_PAYLOAD_MAX_LENGTH)
  name!: string;
}

export class AddCardEntryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Catalogue card, from the licence of the collection.',
  })
  @IsUUID()
  cardId!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Printing (holo, reverse...) of that card, when known.',
  })
  @IsOptional()
  @IsUUID()
  variantId?: string | null;

  @ApiProperty({ example: 2, minimum: 1, maximum: 9999 })
  @IsInt()
  quantity!: number;

  @ApiProperty({ enum: CARD_CONDITIONS, example: 'NM' })
  @IsString()
  condition!: string;

  @ApiProperty({ enum: CARD_LANGUAGES, example: 'fr' })
  @IsString()
  language!: string;

  @ApiPropertyOptional({
    type: Number,
    example: 9.5,
    minimum: 0,
    maximum: 10,
    nullable: true,
    description: 'Professional grade, 0 to 10 with at most one decimal.',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  gradingNote?: number | null;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_PAYLOAD_MAX_LENGTH)
  notes?: string | null;
}

/**
 * Only what an entry lets you change. The card and the printing are what the entry is: to correct
 * them, remove the entry and add another. An absent field is left alone; `null` clears gradingNote
 * or notes. At least one field is required (answered with a 400 by the domain).
 */
export class UpdateCardEntryDto {
  @ApiPropertyOptional({ example: 3, minimum: 1, maximum: 9999 })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsInt()
  quantity?: number;

  @ApiPropertyOptional({ enum: CARD_CONDITIONS })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  condition?: string;

  @ApiPropertyOptional({ enum: CARD_LANGUAGES })
  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsString()
  language?: string;

  @ApiPropertyOptional({ type: Number, minimum: 0, maximum: 10, nullable: true })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  gradingNote?: number | null;

  @ApiPropertyOptional({ type: String, maxLength: 500, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(NOTES_PAYLOAD_MAX_LENGTH)
  notes?: string | null;
}

/** Query string of `GET /collections/:id/cards`. The bounds are the domain's (PageRequest). */
export class ListCardsQueryDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}
