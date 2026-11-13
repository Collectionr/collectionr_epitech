import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH_NAME } from '../../../../shared/bootstrap/SetupSwagger';
import { Audit } from '../../../audit/interface/decorators/Audit';
import { CurrentUser } from '../../../auth/interface/decorators/CurrentUser';
import { JwtAuthGuard } from '../../../auth/interface/guards/JwtAuthGuard';
import type { AuthenticatedUser } from '../../../auth/interface/guards/JwtAuthGuard';
import {
  AddCardEntryDto,
  CreateCollectionDto,
  ListCardsQueryDto,
  UpdateCardEntryDto,
  UpdateCollectionDto,
} from '../../application/dtos/CollectionRequestDtos';
import {
  CardEntryResponseDto,
  CollectionCardsPageResponseDto,
  CollectionResponseDto,
} from '../../application/dtos/CollectionResponseDtos';
import { AddCardEntryUseCase } from '../../application/use-cases/AddCardEntryUseCase';
import { CreateCollectionUseCase } from '../../application/use-cases/CreateCollectionUseCase';
import { DeleteCollectionUseCase } from '../../application/use-cases/DeleteCollectionUseCase';
import { GetCollectionUseCase } from '../../application/use-cases/GetCollectionUseCase';
import { ListCollectionCardsUseCase } from '../../application/use-cases/ListCollectionCardsUseCase';
import { ListCollectionsUseCase } from '../../application/use-cases/ListCollectionsUseCase';
import { RemoveCardEntryUseCase } from '../../application/use-cases/RemoveCardEntryUseCase';
import { UpdateCardEntryUseCase } from '../../application/use-cases/UpdateCardEntryUseCase';
import { UpdateCollectionUseCase } from '../../application/use-cases/UpdateCollectionUseCase';
import { mapCollectionError } from '../MapCollectionError';

const COLLECTION_ID = { name: 'id', format: 'uuid', description: 'Collection id' } as const;
const ENTRY_ID = { name: 'entryId', format: 'uuid', description: 'Card entry id' } as const;

/**
 * The authenticated user's collections and their card entries. The owner is always the user of
 * the session (`@CurrentUser()`), never a value of the request; a collection that is someone
 * else's answers exactly like one that does not exist (404), so ids cannot be probed (IDOR).
 *
 * Every read is `no-store`: the answers are private to the user.
 */
@ApiTags('Collections')
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME)
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@UseGuards(JwtAuthGuard)
@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly createCollectionUseCase: CreateCollectionUseCase,
    private readonly listCollectionsUseCase: ListCollectionsUseCase,
    private readonly getCollectionUseCase: GetCollectionUseCase,
    private readonly updateCollectionUseCase: UpdateCollectionUseCase,
    private readonly deleteCollectionUseCase: DeleteCollectionUseCase,
    private readonly listCollectionCardsUseCase: ListCollectionCardsUseCase,
    private readonly addCardEntryUseCase: AddCardEntryUseCase,
    private readonly updateCardEntryUseCase: UpdateCardEntryUseCase,
    private readonly removeCardEntryUseCase: RemoveCardEntryUseCase,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a collection (10 per user at most)' })
  @ApiCreatedResponse({ description: 'Collection created', type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid payload or collection name' })
  @ApiNotFoundResponse({ description: 'Unknown licence' })
  @ApiConflictResponse({ description: 'The user already owns 10 collections' })
  async create(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: CreateCollectionDto,
  ): Promise<CollectionResponseDto> {
    const collection = await this.run(() =>
      this.createCollectionUseCase.execute({
        userId: currentUser.id,
        licenceTCGId: dto.licenceTCGId,
        name: dto.name,
      }),
    );
    return CollectionResponseDto.fromCollection(collection);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: "List the user's collections, most recent first (not paginated)" })
  @ApiOkResponse({ description: "The user's collections", type: [CollectionResponseDto] })
  async list(@CurrentUser() currentUser: AuthenticatedUser): Promise<CollectionResponseDto[]> {
    const collections = await this.run(() =>
      this.listCollectionsUseCase.execute({ userId: currentUser.id }),
    );
    return collections.map((collection) => CollectionResponseDto.fromCollection(collection));
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Get one collection' })
  @ApiParam(COLLECTION_ID)
  @ApiOkResponse({ description: 'The collection', type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed collection id' })
  @ApiNotFoundResponse({ description: 'No such collection, or it belongs to someone else' })
  async get(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<CollectionResponseDto> {
    const collection = await this.run(() =>
      this.getCollectionUseCase.execute({ userId: currentUser.id, collectionId: id }),
    );
    return CollectionResponseDto.fromCollection(collection);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename a collection (its licence never changes)' })
  @ApiParam(COLLECTION_ID)
  @ApiOkResponse({ description: 'Collection renamed', type: CollectionResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed collection id, invalid payload or name' })
  @ApiNotFoundResponse({ description: 'No such collection, or it belongs to someone else' })
  async rename(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCollectionDto,
  ): Promise<CollectionResponseDto> {
    const collection = await this.run(() =>
      this.updateCollectionUseCase.execute({
        userId: currentUser.id,
        collectionId: id,
        name: dto.name,
      }),
    );
    return CollectionResponseDto.fromCollection(collection);
  }

  // Irreversible, and it removes the collection's entries with it: traced in the audit log.
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Audit({ action: 'collection.delete', targetType: 'collection', targetIdParam: 'id' })
  @ApiOperation({ summary: 'Delete a collection and all its card entries (irreversible, audited)' })
  @ApiParam(COLLECTION_ID)
  @ApiNoContentResponse({ description: 'Collection and entries deleted' })
  @ApiBadRequestResponse({ description: 'Malformed collection id' })
  @ApiNotFoundResponse({ description: 'No such collection, or it belongs to someone else' })
  async remove(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.run(() =>
      this.deleteCollectionUseCase.execute({ userId: currentUser.id, collectionId: id }),
    );
  }

  @Get(':id/cards')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'List the cards of a collection, newest first, with their catalogue data',
    description:
      'Paginated (50 per page by default, 100 at most). Each line carries the card, its set and its printing.',
  })
  @ApiParam(COLLECTION_ID)
  @ApiOkResponse({ description: 'One page of entries', type: CollectionCardsPageResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed collection id, or invalid page parameters' })
  @ApiNotFoundResponse({ description: 'No such collection, or it belongs to someone else' })
  async listCards(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ListCardsQueryDto,
  ): Promise<CollectionCardsPageResponseDto> {
    const page = await this.run(() =>
      this.listCollectionCardsUseCase.execute({
        userId: currentUser.id,
        collectionId: id,
        page: query.page,
        pageSize: query.pageSize,
      }),
    );
    return CollectionCardsPageResponseDto.fromPage(page);
  }

  @Post(':id/cards')
  @ApiOperation({
    summary: 'Add a card to a collection',
    description:
      'Every call adds a new entry: the same card added twice gives two entries, they are not merged.',
  })
  @ApiParam(COLLECTION_ID)
  @ApiCreatedResponse({ description: 'Entry added', type: CardEntryResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed id or invalid payload' })
  @ApiNotFoundResponse({
    description:
      'No such collection (or someone else’s); card or printing unknown, or card from another licence',
  })
  async addCard(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddCardEntryDto,
  ): Promise<CardEntryResponseDto> {
    const entry = await this.run(() =>
      this.addCardEntryUseCase.execute({
        userId: currentUser.id,
        collectionId: id,
        cardId: dto.cardId,
        variantId: dto.variantId,
        quantity: dto.quantity,
        condition: dto.condition,
        language: dto.language,
        gradingNote: dto.gradingNote,
        notes: dto.notes,
      }),
    );
    return CardEntryResponseDto.fromEntry(entry);
  }

  @Patch(':id/cards/:entryId')
  @ApiOperation({
    summary: 'Update an entry (quantity, condition, language, grade, notes)',
    description:
      'Only the given fields are written. The card and the printing cannot be changed: remove the entry and add another.',
  })
  @ApiParam(COLLECTION_ID)
  @ApiParam(ENTRY_ID)
  @ApiOkResponse({ description: 'Entry updated', type: CardEntryResponseDto })
  @ApiBadRequestResponse({ description: 'Malformed id, invalid payload, or nothing to change' })
  @ApiNotFoundResponse({ description: 'No such collection (or someone else’s) or entry' })
  async updateCard(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateCardEntryDto,
  ): Promise<CardEntryResponseDto> {
    const entry = await this.run(() =>
      this.updateCardEntryUseCase.execute({
        userId: currentUser.id,
        collectionId: id,
        entryId,
        changes: {
          quantity: dto.quantity,
          condition: dto.condition,
          language: dto.language,
          gradingNote: dto.gradingNote,
          notes: dto.notes,
        },
      }),
    );
    return CardEntryResponseDto.fromEntry(entry);
  }

  @Delete(':id/cards/:entryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an entry from a collection' })
  @ApiParam(COLLECTION_ID)
  @ApiParam(ENTRY_ID)
  @ApiNoContentResponse({ description: 'Entry removed' })
  @ApiBadRequestResponse({ description: 'Malformed id' })
  @ApiNotFoundResponse({ description: 'No such collection (or someone else’s) or entry' })
  async removeCard(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Param('id') id: string,
    @Param('entryId') entryId: string,
  ): Promise<void> {
    await this.run(() =>
      this.removeCardEntryUseCase.execute({
        userId: currentUser.id,
        collectionId: id,
        entryId,
      }),
    );
  }

  /** Runs a use case and turns its known errors into HTTP ones (see mapCollectionError). */
  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      mapCollectionError(error);
      throw error;
    }
  }
}
