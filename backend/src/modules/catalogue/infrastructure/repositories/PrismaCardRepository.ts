import { Inject, Injectable } from '@nestjs/common';
import type { PrismaClient } from '../../../../generated/prisma/client.js';
import { PRISMA_CLIENT } from '../../../../shared/infrastructure/database/PrismaModule';
import { isUuid } from '../../../../shared/infrastructure/IsUuid';
import type { ICardRepository } from '../../application/ports/ICardRepository';
import { Card } from '../../domain/entities/Card';
import type { CardNameSearch } from '../../domain/value-objects/CardNameSearch';
import { CARD_INCLUDE, toCard } from './CardMapper';

// In a LIKE pattern, backslash is the escape character and % and _ are wildcards.
const LIKE_SPECIAL_CHARACTERS = /[\\%_]/g;

/**
 * Prisma passes the term of a contains filter to ILIKE as it is: left alone, a search for %% or __
 * would match every card. The term is searched as plain text.
 */
function escapeLikeTerm(term: string): string {
  return term.replace(LIKE_SPECIAL_CHARACTERS, '\\$&');
}

@Injectable()
export class PrismaCardRepository implements ICardRepository {
  constructor(@Inject(PRISMA_CLIENT) private readonly prismaClient: PrismaClient) {}

  async findById(id: string): Promise<Card | null> {
    // PostgreSQL rejects a malformed UUID with an error: such an id simply cannot exist.
    if (!isUuid(id)) {
      return null;
    }

    const record = await this.prismaClient.card.findUnique({
      where: { id },
      include: CARD_INCLUDE,
    });

    return record ? toCard(record) : null;
  }

  async findBySetId(setId: string): Promise<readonly Card[]> {
    if (!isUuid(setId)) {
      return [];
    }

    const records = await this.prismaClient.card.findMany({
      where: { setId },
      include: CARD_INCLUDE,
    });

    // The number is text (10 sorts before 9 in SQL): the printed order is applied here.
    return records.map(toCard).sort((a, b) => Card.compareByNumber(a, b));
  }

  async searchByName(search: CardNameSearch): Promise<readonly Card[]> {
    const term = escapeLikeTerm(search.term);
    const records = await this.prismaClient.card.findMany({
      where: {
        OR: [
          { nameEn: { contains: term, mode: 'insensitive' } },
          { nameFr: { contains: term, mode: 'insensitive' } },
        ],
      },
      include: CARD_INCLUDE,
      orderBy: [{ nameEn: 'asc' }, { tcgdexId: 'asc' }],
      take: search.limit,
    });

    return records.map(toCard);
  }
}
