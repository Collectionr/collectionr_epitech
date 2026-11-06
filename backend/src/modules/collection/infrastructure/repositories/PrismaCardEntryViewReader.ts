import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import type {
  CardEntryView,
  ICardEntryViewReader,
} from '../../application/ports/ICardEntryViewReader';
import type { Page } from '../../application/ports/Page';
import type { PageRequest } from '../../domain/value-objects/PageRequest';
import { toCardEntry } from './CollectionMapper';
import { CARD_ENTRY_ORDER } from './PrismaCollectionRepository';

/**
 * Entries joined with the catalogue in one query (no query per entry): the card, its set and the
 * printing come with the page. Only the columns the screen shows are selected.
 */
@Injectable()
export class PrismaCardEntryViewReader implements ICardEntryViewReader {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async findCardEntryViews(collectionId: string, page: PageRequest): Promise<Page<CardEntryView>> {
    if (!isUuid(collectionId)) {
      return { items: [], total: 0, page: page.page, pageSize: page.pageSize };
    }

    const [total, records] = await this.prismaClient.$transaction([
      this.prismaClient.cardEntry.count({ where: { collectionId } }),
      this.prismaClient.cardEntry.findMany({
        where: { collectionId },
        orderBy: CARD_ENTRY_ORDER,
        skip: page.offset,
        take: page.pageSize,
        include: {
          card: {
            select: {
              id: true,
              number: true,
              nameEn: true,
              nameFr: true,
              category: true,
              rarity: true,
              imageUrlEn: true,
              imageUrlFr: true,
              set: {
                select: {
                  id: true,
                  tcgdexId: true,
                  nameEn: true,
                  nameFr: true,
                  abbreviationOfficial: true,
                },
              },
            },
          },
          variant: {
            select: {
              id: true,
              type: true,
              subtype: true,
              size: true,
              stamps: true,
              foil: true,
            },
          },
        },
      }),
    ]);

    return {
      items: records.map(({ card, variant, ...entry }) => ({
        entry: toCardEntry(entry),
        card: {
          id: card.id,
          number: card.number,
          nameEn: card.nameEn,
          nameFr: card.nameFr,
          category: card.category,
          rarity: card.rarity,
          imageUrlEn: card.imageUrlEn,
          imageUrlFr: card.imageUrlFr,
        },
        set: card.set,
        variant,
      })),
      total,
      page: page.page,
      pageSize: page.pageSize,
    };
  }
}
