import { describe, expect, it, vi } from 'vitest';

import { TEST_CARD, TEST_SET } from '../hooks/mocks/createCollectionHarness';
import type { ApiClient } from './apiClient';
import { createCatalogService } from './catalogService';

const VARIANT = {
  id: '1f37930e-2688-49c9-8e94-e5d265bad764',
  type: 'holo',
  subtype: 'unlimited',
  size: 'standard',
  stamps: [],
  foil: null,
};

const RESULT = { card: TEST_CARD, set: TEST_SET, variants: [VARIANT] };

function serviceReturning(body: unknown) {
  const client = { request: vi.fn(async () => body) } satisfies ApiClient;
  return { client, service: createCatalogService({ client }) };
}

describe('catalogService.search', () => {
  it('cherche le terme encodé, 20 résultats au plus, et renvoie les cartes', async () => {
    const { client, service } = serviceReturning([RESULT]);

    await expect(service.search('Dracaufeu & co')).resolves.toEqual([RESULT]);
    expect(client.request).toHaveBeenCalledWith(
      '/catalogue/cards/search?q=Dracaufeu%20%26%20co&limit=20',
      { signal: undefined },
    );
  });

  it('transmet le signal d’annulation au client', async () => {
    const { client, service } = serviceReturning([]);
    const signal = { aborted: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };

    await service.search('Pika', { signal });

    expect(client.request).toHaveBeenCalledWith(expect.any(String), { signal });
  });

  it.each([
    ['un objet au lieu d’une liste', { items: [RESULT] }],
    ['une carte incomplète', [{ ...RESULT, card: { id: 'x' } }]],
    ['un set absent', [{ ...RESULT, set: undefined }]],
    ['des impressions qui ne sont pas une liste', [{ ...RESULT, variants: VARIANT }]],
    ['une impression incomplète', [{ ...RESULT, variants: [{ id: 'v' }] }]],
  ])('refuse %s', async (_case, body) => {
    const { service } = serviceReturning(body);

    await expect(service.search('Pika')).rejects.toThrow(
      'Réponse inattendue de /catalogue/cards/search',
    );
  });
});
