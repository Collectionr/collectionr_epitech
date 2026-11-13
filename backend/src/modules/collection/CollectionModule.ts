import { Module } from '@nestjs/common';
import { PrismaModule } from '../../shared/infrastructure/database/PrismaModule';
import { AuthModule } from '../auth/AuthModule';
import { CARD_ENTRY_VIEW_READER } from './application/ports/ICardEntryViewReader';
import { COLLECTION_REPOSITORY } from './application/ports/ICollectionRepository';
import { AddCardEntryUseCase } from './application/use-cases/AddCardEntryUseCase';
import { CreateCollectionUseCase } from './application/use-cases/CreateCollectionUseCase';
import { DeleteCollectionUseCase } from './application/use-cases/DeleteCollectionUseCase';
import { GetCollectionUseCase } from './application/use-cases/GetCollectionUseCase';
import { ListCollectionCardsUseCase } from './application/use-cases/ListCollectionCardsUseCase';
import { ListCollectionsUseCase } from './application/use-cases/ListCollectionsUseCase';
import { RemoveCardEntryUseCase } from './application/use-cases/RemoveCardEntryUseCase';
import { UpdateCardEntryUseCase } from './application/use-cases/UpdateCardEntryUseCase';
import { UpdateCollectionUseCase } from './application/use-cases/UpdateCollectionUseCase';
import { PrismaCardEntryViewReader } from './infrastructure/repositories/PrismaCardEntryViewReader';
import { PrismaCollectionRepository } from './infrastructure/repositories/PrismaCollectionRepository';
import { CollectionsController } from './interface/controllers/CollectionsController';

/**
 * Collections and their card entries (COLLR-416 domain, COLLR-417 infrastructure and API).
 * AuthModule provides the JwtAuthGuard that protects every route.
 */
@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CollectionsController],
  providers: [
    CreateCollectionUseCase,
    ListCollectionsUseCase,
    GetCollectionUseCase,
    UpdateCollectionUseCase,
    DeleteCollectionUseCase,
    AddCardEntryUseCase,
    UpdateCardEntryUseCase,
    RemoveCardEntryUseCase,
    ListCollectionCardsUseCase,
    { provide: COLLECTION_REPOSITORY, useClass: PrismaCollectionRepository },
    { provide: CARD_ENTRY_VIEW_READER, useClass: PrismaCardEntryViewReader },
  ],
})
export class CollectionModule {}
