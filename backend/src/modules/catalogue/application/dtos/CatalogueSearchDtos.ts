import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { CardSearchResult } from '../../domain/entities/CardSearchResult';

export class SearchCardsQueryDto {
  @ApiPropertyOptional({
    example: 'charizard',
    description: 'Alias for query, matching the existing frontend API convention.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  q?: string;

  @ApiPropertyOptional({
    example: 'chariz',
    description: 'General term searched across card names, set names/codes and card numbers.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  query?: string;

  @ApiPropertyOptional({
    example: 'Charizard',
    description: 'Partial card name in English or French.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  name?: string;

  @ApiPropertyOptional({ example: 'Darkness Ablaze', description: 'Partial set name or set code.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  set?: string;

  @ApiPropertyOptional({
    example: '006',
    description: 'Partial or exact printed card number, preserved as text so leading zeros remain.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  number?: string;

  @ApiPropertyOptional({
    enum: ['en', 'fr'],
    default: 'en',
    description: 'Preferred language metadata.',
  })
  @IsOptional()
  @IsIn(['en', 'fr'])
  language?: 'en' | 'fr';

  @ApiPropertyOptional({ minimum: 1, maximum: 50, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

export class CardSearchSetDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'swsh3' })
  tcgdexId!: string;

  @ApiProperty({ example: 'Darkness Ablaze' })
  nameEn!: string;

  @ApiProperty({ type: String, example: 'Ténèbres Embrasées', nullable: true })
  nameFr!: string | null;

  @ApiProperty({ type: String, example: 'DAA', nullable: true })
  abbreviationOfficial!: string | null;
  @ApiProperty({ type: String, example: 'TEM', nullable: true })
  abbreviationFr!: string | null;
}

export class CardSearchResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'swsh3-20' })
  tcgdexId!: string;

  @ApiProperty({
    example: '20',
    description: 'Printed number; leading zeros and prefixes are preserved.',
  })
  number!: string;

  @ApiProperty({ example: 'Charizard VMAX' })
  name!: string;

  @ApiProperty({ example: 'Charizard VMAX' })
  nameEn!: string;

  @ApiProperty({ type: String, example: 'Dracaufeu VMAX', nullable: true })
  nameFr!: string | null;

  @ApiProperty({ type: CardSearchSetDto })
  set!: CardSearchSetDto;

  @ApiProperty({ type: String, nullable: true })
  imageUrlEn!: string | null;

  @ApiProperty({ type: String, nullable: true })
  imageUrlFr!: string | null;

  static fromCard(card: CardSearchResult, language: 'en' | 'fr'): CardSearchResponseDto {
    const dto = new CardSearchResponseDto();
    dto.id = card.id;
    dto.tcgdexId = card.tcgdexId;
    dto.number = card.number;
    dto.nameEn = card.nameEn;
    dto.nameFr = card.nameFr;
    dto.name = language === 'fr' ? (card.nameFr ?? card.nameEn) : card.nameEn;
    dto.set = {
      id: card.set.id,
      tcgdexId: card.set.tcgdexId,
      nameEn: card.set.nameEn,
      nameFr: card.set.nameFr,
      abbreviationOfficial: card.set.abbreviationOfficial,
      abbreviationFr: card.set.abbreviationFr,
    };
    dto.imageUrlEn = card.imageUrlEn;
    dto.imageUrlFr = card.imageUrlFr;
    return dto;
  }
}
