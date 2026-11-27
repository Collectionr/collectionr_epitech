import type { CardSearchResult } from '../../domain/entities/CardSearchResult';
import type { ICardRepository } from '../ports/ICardRepository';
import { SearchCardsUseCase } from './SearchCardsUseCase';

describe('SearchCardsUseCase', () => {
  it('validates the request and delegates it to the read repository', async () => {
    const cards = [] as readonly CardSearchResult[];
    const search = jest.fn().mockResolvedValue(cards);
    const repository: ICardRepository = {
      findById: jest.fn(),
      findBySetId: jest.fn(),
      searchByName: jest.fn(),
      search,
    };
    const useCase = new SearchCardsUseCase(repository);

    await expect(useCase.execute({ query: 'dracau', language: 'fr', limit: 5 })).resolves.toBe(
      cards,
    );

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'dracau', language: 'fr', limit: 5 }),
    );
  });

  it('rejects a request without search criteria', async () => {
    const search = jest.fn();
    const repository: ICardRepository = {
      findById: jest.fn(),
      findBySetId: jest.fn(),
      searchByName: jest.fn(),
      search,
    };
    const useCase = new SearchCardsUseCase(repository);

    await expect(useCase.execute({})).rejects.toThrow('At least one search parameter');
    expect(search).not.toHaveBeenCalled();
  });
});
