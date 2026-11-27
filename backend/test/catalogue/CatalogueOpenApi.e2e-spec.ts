// This test uses createAuthTestApp's infrastructure doubles. It validates HTTP and OpenAPI
// behavior only; PostgreSQL is covered separately by the integration suite.
process.env.THROTTLE_LIMIT = '100000';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { createAuthTestApp } from '../auth/AuthTestDoubles';
import type { AuthTestContext } from '../auth/AuthTestDoubles';
import { CARD_REPOSITORY } from '../../src/modules/catalogue/application/ports/ICardRepository';
import type { ICardRepository } from '../../src/modules/catalogue/application/ports/ICardRepository';
import type { CardSearchResult } from '../../src/modules/catalogue/domain/entities/CardSearchResult';
import type { CardSearchResponseDto } from '../../src/modules/catalogue/application/dtos/CatalogueSearchDtos';

const RESULT: CardSearchResult = {
  id: 'c36fbf34-c84d-4464-a0a4-aa1839ad1add',
  tcgdexId: 'swsh3-20',
  number: '20',
  nameEn: 'Charizard VMAX',
  nameFr: 'Dracaufeu VMAX',
  imageUrlEn: 'https://assets.tcgdex.net/en/swsh/swsh3/20',
  imageUrlFr: 'https://assets.tcgdex.net/fr/swsh/swsh3/20',
  set: {
    id: '1de9327c-6851-4e26-b347-322d465e34f7',
    tcgdexId: 'swsh3',
    nameEn: 'Darkness Ablaze',
    nameFr: 'Ténèbres Embrasées',
    abbreviationOfficial: 'DAA',
    abbreviationFr: 'TEM',
  },
};

describe('Catalogue search (e2e and OpenAPI)', () => {
  let context: AuthTestContext;
  let document: OpenAPIObject;
  let search: jest.Mock;

  beforeAll(async () => {
    search = jest.fn().mockResolvedValue([RESULT]);
    const repository: ICardRepository = {
      findById: jest.fn(),
      findBySetId: jest.fn(),
      searchByName: jest.fn(),
      search,
    };
    context = await createAuthTestApp({
      overrides: [{ token: CARD_REPOSITORY, value: repository }],
    });
    document = SwaggerModule.createDocument(context.app, new DocumentBuilder().build());
  });

  afterAll(async () => {
    await context.app.close();
  });

  it('documents the public route with all catalogue parameters', () => {
    const operation = document.paths['/api/v1/cards/search']?.get;

    expect(operation).toBeDefined();
    expect(operation?.tags).toContain('Cartes');
    expect(operation?.security ?? []).toEqual([]);
    expect(
      operation?.parameters?.map((parameter) => ('name' in parameter ? parameter.name : '')),
    ).toEqual(expect.arrayContaining(['q', 'query', 'name', 'set', 'number', 'language', 'limit']));
  });

  it('returns a limited catalogue result without authentication', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/v1/cards/search?q=chariz&limit=10&language=fr',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<readonly CardSearchResponseDto[]>();
    expect(body).toHaveLength(1);
    expect(body[0].tcgdexId).toBe('swsh3-20');
    expect(body[0].number).toBe('20');
    expect(body[0].name).toBe('Dracaufeu VMAX');
    expect(body[0].set.tcgdexId).toBe('swsh3');
  });

  it('returns an empty array when the repository has no match', async () => {
    search.mockResolvedValueOnce([]);

    const response = await context.app.inject({
      method: 'GET',
      url: '/api/v1/cards/search?number=999',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('rejects invalid limits and conflicting q/query aliases', async () => {
    const invalidLimit = await context.app.inject({
      method: 'GET',
      url: '/api/v1/cards/search?name=Pikachu&limit=51',
    });
    const conflictingAliases = await context.app.inject({
      method: 'GET',
      url: '/api/v1/cards/search?q=Pikachu&query=Charizard',
    });

    expect(invalidLimit.statusCode).toBe(400);
    expect(conflictingAliases.statusCode).toBe(400);
  });

  it('rejects unknown parameters at the HTTP boundary', async () => {
    const response = await context.app.inject({
      method: 'GET',
      url: '/api/v1/cards/search?name=Pikachu&unknown=value',
    });

    expect(response.statusCode).toBe(400);
  });
});
