import { Inject, Injectable } from '@nestjs/common';
import type { CardSearchResult } from '../../domain/entities/CardSearchResult';
import { CardCatalogueSearch } from '../../domain/value-objects/CardCatalogueSearch';
import type { CatalogueSearchLanguage } from '../../domain/value-objects/CardCatalogueSearch';
import { CARD_REPOSITORY } from '../ports/ICardRepository';
import type { ICardRepository } from '../ports/ICardRepository';

export interface SearchCardsInput {
  readonly query?: string;
  readonly name?: string;
  readonly set?: string;
  readonly number?: string;
  readonly language?: CatalogueSearchLanguage;
  readonly limit?: number;
}

@Injectable()
export class SearchCardsUseCase {
  constructor(@Inject(CARD_REPOSITORY) private readonly cardRepository: ICardRepository) {}

  async execute(input: SearchCardsInput): Promise<readonly CardSearchResult[]> {
    const search = CardCatalogueSearch.create(input);
    return this.cardRepository.search(search);
  }
}
