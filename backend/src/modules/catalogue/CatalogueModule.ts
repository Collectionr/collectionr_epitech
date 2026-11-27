import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';
import { CARD_REPOSITORY } from './application/ports/ICardRepository';
import { PrismaCardRepository } from './infrastructure/repositories/PrismaCardRepository';
import { SearchCardsUseCase } from './application/use-cases/SearchCardsUseCase';
import { CatalogueController } from './interface/controllers/CatalogueController';

/**
 * Card catalogue (licences, sets, cards, printings), read only. It exposes the card repository
 * and nothing else for now: the use cases and the endpoints of the catalogue (search, autocomplete)
 * come with COLLR-418 and import this module.
 */
@Module({
  imports: [PrismaModule],
  controllers: [CatalogueController],
  providers: [SearchCardsUseCase, { provide: CARD_REPOSITORY, useClass: PrismaCardRepository }],
  exports: [CARD_REPOSITORY],
})
export class CatalogueModule {}
