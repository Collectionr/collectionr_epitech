import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import {
  CardSearchResponseDto,
  SearchCardsQueryDto,
} from '../../application/dtos/CatalogueSearchDtos';
import { SearchCardsUseCase } from '../../application/use-cases/SearchCardsUseCase';
import { mapCatalogueError } from '../MapCatalogueError';

@ApiTags('Cartes')
@Controller('cards')
export class CatalogueController {
  constructor(private readonly searchCardsUseCase: SearchCardsUseCase) {}

  @Get('search')
  @Header('Cache-Control', 'public, max-age=60')
  @ApiOperation({
    summary: 'Search cards for autocomplete',
    description:
      'Public read-only search by partial card name, set name/code or printed card number. ' +
      'Case-insensitive. Names, set names and card numbers are searched in PostgreSQL and results are limited.',
  })
  @ApiOkResponse({
    description: 'Matching cards, ordered by name and TCGdex id; an empty array means no match',
    type: [CardSearchResponseDto],
  })
  @ApiBadRequestResponse({
    description: 'Missing search criteria or invalid term/limit',
  })
  @ApiTooManyRequestsResponse({ description: 'Too many requests' })
  async search(@Query() query: SearchCardsQueryDto): Promise<CardSearchResponseDto[]> {
    try {
      if (
        query.q !== undefined &&
        query.query !== undefined &&
        query.q.trim() !== query.query.trim()
      ) {
        throw new BadRequestException(
          'q and query must have the same value when both are provided',
        );
      }
      const cards = await this.searchCardsUseCase.execute({
        query: query.q ?? query.query,
        name: query.name,
        set: query.set,
        number: query.number,
        language: query.language,
        limit: query.limit,
      });
      return cards.map((card) => CardSearchResponseDto.fromCard(card, query.language ?? 'en'));
    } catch (error) {
      mapCatalogueError(error);
      throw error;
    }
  }
}
