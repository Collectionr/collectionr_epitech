import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from './apiClient';
import {
  createQueryClient,
  DEFAULT_GC_TIME_MS,
  DEFAULT_STALE_TIME_MS,
  shouldRetryQuery,
} from './queryClient';

function apiError(status: number): ApiError {
  return new ApiError({ status, code: `HTTP_${status}`, message: `HTTP ${status}` });
}

describe('shouldRetryQuery', () => {
  it.each([400, 401, 403, 404, 409, 429])('ne relance jamais une erreur %i', (status) => {
    expect(shouldRetryQuery(0, apiError(status))).toBe(false);
  });

  it.each([
    ['une erreur 500', apiError(500)],
    ['une erreur 503', apiError(503)],
    ['un serveur injoignable', new NetworkError('connection', 'Serveur injoignable')],
    ['un délai dépassé', new NetworkError('timeout', 'Délai dépassé')],
  ])('relance %s au plus deux fois', (_label, error) => {
    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(true);
    expect(shouldRetryQuery(2, error)).toBe(false);
  });

  it('ne relance pas une erreur inattendue', () => {
    expect(shouldRetryQuery(0, new TypeError('x is undefined'))).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('applique les durées de cache et la politique de relance par défaut', () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();

    expect(queries).toMatchObject({
      staleTime: DEFAULT_STALE_TIME_MS,
      gcTime: DEFAULT_GC_TIME_MS,
      retry: shouldRetryQuery,
      refetchOnWindowFocus: false,
    });
    expect(mutations).toMatchObject({ retry: false });
  });

  it('relance une requête après une erreur réseau, mais pas après une 404', async () => {
    const client = createQueryClient();
    client.setDefaultOptions({
      queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
    });
    let networkAttempts = 0;
    let notFoundAttempts = 0;

    await client
      .fetchQuery({
        queryKey: ['réseau'],
        queryFn: () => {
          networkAttempts += 1;
          return Promise.reject(new NetworkError('connection', 'Serveur injoignable'));
        },
      })
      .catch(() => undefined);
    await client
      .fetchQuery({
        queryKey: ['introuvable'],
        queryFn: () => {
          notFoundAttempts += 1;
          return Promise.reject(apiError(404));
        },
      })
      .catch(() => undefined);

    expect(networkAttempts).toBe(3);
    expect(notFoundAttempts).toBe(1);
  });
});
