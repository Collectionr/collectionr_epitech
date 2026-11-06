import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';
import { CARD_REPOSITORY } from './application/ports/ICardRepository';
import { PrismaCardRepository } from './infrastructure/repositories/PrismaCardRepository';

/**
 * Card catalogue (licences, sets, cards, printings), read only. It exposes the card repository
 * and nothing else for now: the use cases and the endpoints of the catalogue (search, autocomplete)
 * come with COLLR-418 and import this module.
 */
@Module({
  imports: [PrismaModule],
  providers: [{ provide: CARD_REPOSITORY, useClass: PrismaCardRepository }],
  exports: [CARD_REPOSITORY],
})
export class CatalogueModule {}
