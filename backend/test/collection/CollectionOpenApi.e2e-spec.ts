// Injected before AppModule loads (see AuthController.e2e-spec.ts): the global limiter is not under test.
process.env.THROTTLE_LIMIT = '100000';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { createAuthTestApp } from '../auth/AuthTestDoubles';
import type { AuthTestContext } from '../auth/AuthTestDoubles';

interface SchemaProperty {
  readonly type?: string;
  readonly nullable?: boolean;
  readonly allOf?: readonly { readonly $ref?: string }[];
  readonly $ref?: string;
}

interface Schema {
  readonly properties?: Record<string, SchemaProperty>;
}

/**
 * The generated OpenAPI document is the contract of the API for the front-end and for any client
 * generated from it. A TypeScript union with null (`number | null`) is reflected as `Object` unless
 * the decorator names the primitive: such a field would be documented as an object although the API
 * accepts and returns a number or a string.
 */
describe('Collections OpenAPI document (e2e)', () => {
  let context: AuthTestContext;
  let document: OpenAPIObject;

  beforeAll(async () => {
    context = await createAuthTestApp();
    document = SwaggerModule.createDocument(context.app, new DocumentBuilder().build());
  });

  afterAll(async () => {
    await context.app.close();
  });

  const property = (schema: string, name: string): SchemaProperty => {
    const found = (document.components?.schemas?.[schema] as Schema | undefined)?.properties?.[
      name
    ];
    if (found === undefined) {
      throw new Error(`${schema}.${name} is not in the OpenAPI document`);
    }
    return found;
  };

  const NULLABLE_PRIMITIVES: readonly [string, string, 'string' | 'number'][] = [
    ['AddCardEntryDto', 'variantId', 'string'],
    ['AddCardEntryDto', 'gradingNote', 'number'],
    ['AddCardEntryDto', 'notes', 'string'],
    ['UpdateCardEntryDto', 'gradingNote', 'number'],
    ['UpdateCardEntryDto', 'notes', 'string'],
    ['CardEntryResponseDto', 'variantId', 'string'],
    ['CardEntryResponseDto', 'gradingNote', 'number'],
    ['CardEntryResponseDto', 'notes', 'string'],
    ['CardEntryViewResponseDto', 'variantId', 'string'],
    ['CardEntryViewResponseDto', 'gradingNote', 'number'],
    ['CardEntryViewResponseDto', 'notes', 'string'],
    ['CardViewDto', 'nameFr', 'string'],
    ['CardViewDto', 'rarity', 'string'],
    ['CardViewDto', 'imageUrlEn', 'string'],
    ['CardViewDto', 'imageUrlFr', 'string'],
    ['SetViewDto', 'nameFr', 'string'],
    ['SetViewDto', 'abbreviationOfficial', 'string'],
    ['VariantViewDto', 'subtype', 'string'],
    ['VariantViewDto', 'foil', 'string'],
  ];

  it.each(NULLABLE_PRIMITIVES)(
    'documents %s.%s as a nullable %s, not as an object',
    (schema, name, type) => {
      expect(property(schema, name)).toMatchObject({ type, nullable: true });
    },
  );

  it('documents the nullable printing of a listed entry as a reference to VariantViewDto', () => {
    const variant = property('CardEntryViewResponseDto', 'variant');

    expect(variant.nullable).toBe(true);
    expect(JSON.stringify(variant)).toContain('#/components/schemas/VariantViewDto');
  });

  it('documents the nine routes of the collections', () => {
    const operations = Object.entries(document.paths)
      .filter(([path]) => path.startsWith('/api/v1/collections'))
      .flatMap(([path, item]) =>
        ['get', 'post', 'patch', 'delete']
          .filter((method) => method in item)
          .map((m) => `${m} ${path}`),
      );

    expect(operations.sort()).toEqual(
      [
        'post /api/v1/collections',
        'get /api/v1/collections',
        'get /api/v1/collections/{id}',
        'patch /api/v1/collections/{id}',
        'delete /api/v1/collections/{id}',
        'get /api/v1/collections/{id}/cards',
        'post /api/v1/collections/{id}/cards',
        'patch /api/v1/collections/{id}/cards/{entryId}',
        'delete /api/v1/collections/{id}/cards/{entryId}',
      ].sort(),
    );
  });
});
