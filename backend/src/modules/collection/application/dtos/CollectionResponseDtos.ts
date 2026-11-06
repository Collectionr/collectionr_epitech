import { ApiProperty } from '@nestjs/swagger';
import type { CardEntry } from '../../domain/entities/CardEntry';
import type { Collection } from '../../domain/entities/Collection';
import { CARD_CONDITIONS } from '../../domain/value-objects/CardCondition';
import { CARD_LANGUAGES } from '../../domain/value-objects/CardLanguage';
import type {
  CardEntryCardView,
  CardEntrySetView,
  CardEntryVariantView,
  CardEntryView,
} from '../ports/ICardEntryViewReader';
import type { Page } from '../ports/Page';

// Every response is built field by field, on purpose: whatever else a domain object ever carries
// (the owner, an internal column) is not exposed by accident.

export class CollectionResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  licenceTCGId!: string;

  @ApiProperty({ example: 'Ma collection Écarlate et Violet' })
  name!: string;

  @ApiProperty({ example: '2026-11-06T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-11-06T12:00:00.000Z' })
  updatedAt!: string;

  static fromCollection(collection: Collection): CollectionResponseDto {
    const dto = new CollectionResponseDto();
    dto.id = collection.id;
    dto.licenceTCGId = collection.licenceTCGId;
    dto.name = collection.name;
    dto.createdAt = collection.createdAt.toISOString();
    dto.updatedAt = collection.updatedAt.toISOString();
    return dto;
  }
}

export class CardEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  collectionId!: string;

  @ApiProperty({ format: 'uuid' })
  cardId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  variantId!: string | null;

  @ApiProperty({ example: 2 })
  quantity!: number;

  @ApiProperty({ enum: CARD_CONDITIONS })
  condition!: string;

  @ApiProperty({ enum: CARD_LANGUAGES })
  language!: string;

  @ApiProperty({ example: 9.5, nullable: true })
  gradingNote!: number | null;

  @ApiProperty({ nullable: true })
  notes!: string | null;

  @ApiProperty({ example: '2026-11-06T12:00:00.000Z' })
  addedAt!: string;

  @ApiProperty({ example: '2026-11-06T12:00:00.000Z' })
  updatedAt!: string;

  static fromEntry(entry: CardEntry): CardEntryResponseDto {
    const dto = new CardEntryResponseDto();
    dto.id = entry.id;
    dto.collectionId = entry.collectionId;
    dto.cardId = entry.cardId;
    dto.variantId = entry.variantId;
    dto.quantity = entry.quantity;
    dto.condition = entry.condition;
    dto.language = entry.language;
    dto.gradingNote = entry.gradingNote;
    dto.notes = entry.notes;
    dto.addedAt = entry.addedAt.toISOString();
    dto.updatedAt = entry.updatedAt.toISOString();
    return dto;
  }
}

export class CardViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: '006', description: 'Number inside the set, as printed.' })
  number!: string;

  @ApiProperty({ example: 'Charizard' })
  nameEn!: string;

  @ApiProperty({ example: 'Dracaufeu', nullable: true })
  nameFr!: string | null;

  @ApiProperty({ example: 'Pokemon', description: 'Code in English, translated by the front-end.' })
  category!: string;

  @ApiProperty({ example: 'Holo Rare', nullable: true })
  rarity!: string | null;

  @ApiProperty({
    nullable: true,
    description: 'Image base URL without extension (append /low.webp or /high.webp).',
  })
  imageUrlEn!: string | null;

  @ApiProperty({ nullable: true })
  imageUrlFr!: string | null;

  static from(card: CardEntryCardView): CardViewDto {
    const dto = new CardViewDto();
    dto.id = card.id;
    dto.number = card.number;
    dto.nameEn = card.nameEn;
    dto.nameFr = card.nameFr;
    dto.category = card.category;
    dto.rarity = card.rarity;
    dto.imageUrlEn = card.imageUrlEn;
    dto.imageUrlFr = card.imageUrlFr;
    return dto;
  }
}

export class SetViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'swsh3' })
  tcgdexId!: string;

  @ApiProperty({ example: 'Darkness Ablaze' })
  nameEn!: string;

  @ApiProperty({ example: 'Ténèbres Embrasées', nullable: true })
  nameFr!: string | null;

  @ApiProperty({ example: 'DAA', nullable: true })
  abbreviationOfficial!: string | null;

  static from(set: CardEntrySetView): SetViewDto {
    const dto = new SetViewDto();
    dto.id = set.id;
    dto.tcgdexId = set.tcgdexId;
    dto.nameEn = set.nameEn;
    dto.nameFr = set.nameFr;
    dto.abbreviationOfficial = set.abbreviationOfficial;
    return dto;
  }
}

export class VariantViewDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'holo' })
  type!: string;

  @ApiProperty({ example: 'unlimited', nullable: true })
  subtype!: string | null;

  @ApiProperty({ example: 'standard' })
  size!: string;

  @ApiProperty({ type: [String], example: ['1st-edition'] })
  stamps!: string[];

  @ApiProperty({ example: 'gold', nullable: true })
  foil!: string | null;

  static from(variant: CardEntryVariantView): VariantViewDto {
    const dto = new VariantViewDto();
    dto.id = variant.id;
    dto.type = variant.type;
    dto.subtype = variant.subtype;
    dto.size = variant.size;
    dto.stamps = [...variant.stamps];
    dto.foil = variant.foil;
    return dto;
  }
}

/** One line of a collection with the catalogue data needed to display it. */
export class CardEntryViewResponseDto extends CardEntryResponseDto {
  @ApiProperty({ type: CardViewDto })
  card!: CardViewDto;

  @ApiProperty({ type: SetViewDto })
  set!: SetViewDto;

  @ApiProperty({ type: VariantViewDto, nullable: true })
  variant!: VariantViewDto | null;

  static fromView(view: CardEntryView): CardEntryViewResponseDto {
    const dto = Object.assign(
      new CardEntryViewResponseDto(),
      CardEntryResponseDto.fromEntry(view.entry),
    );
    dto.card = CardViewDto.from(view.card);
    dto.set = SetViewDto.from(view.set);
    dto.variant = view.variant === null ? null : VariantViewDto.from(view.variant);
    return dto;
  }
}

export class CollectionCardsPageResponseDto {
  @ApiProperty({ type: [CardEntryViewResponseDto] })
  items!: CardEntryViewResponseDto[];

  @ApiProperty({ example: 137, description: 'Entries in the whole collection, not in this page.' })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 50 })
  pageSize!: number;

  static fromPage(page: Page<CardEntryView>): CollectionCardsPageResponseDto {
    const dto = new CollectionCardsPageResponseDto();
    dto.items = page.items.map((view) => CardEntryViewResponseDto.fromView(view));
    dto.total = page.total;
    dto.page = page.page;
    dto.pageSize = page.pageSize;
    return dto;
  }
}
