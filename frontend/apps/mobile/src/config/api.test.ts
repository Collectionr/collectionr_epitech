import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { ApiClient } from '@shared/services';

const VALID_API_URL = 'https://api.example.test/api/v1';

const initialApiUrl = process.env.EXPO_PUBLIC_API_URL;
const initialFetch = globalThis.fetch;

/** Charge config/api.ts à neuf (registre vidé par jest.resetModules), ce qui rejoue ses contrôles. */
function loadApiConfig() {
  return jest.requireActual<{ apiClient: ApiClient }>('./api');
}

function setApiUrl(value: string | undefined) {
  if (value === undefined) {
    delete process.env.EXPO_PUBLIC_API_URL;
  } else {
    process.env.EXPO_PUBLIC_API_URL = value;
  }
}

describe('apiClient', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    setApiUrl(initialApiUrl);
    globalThis.fetch = initialFetch;
  });

  it('lève une erreur si EXPO_PUBLIC_API_URL est absente', () => {
    setApiUrl(undefined);

    expect(loadApiConfig).toThrow('EXPO_PUBLIC_API_URL est absente');
  });

  it('lève une erreur si EXPO_PUBLIC_API_URL est relative', () => {
    setApiUrl('/api/v1');

    expect(loadApiConfig).toThrow('doit être une URL absolue');
  });

  it("crée le client sur l'URL de EXPO_PUBLIC_API_URL", async () => {
    setApiUrl(VALID_API_URL);
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(new Response('{}'));
    globalThis.fetch = fetchMock;

    const { apiClient } = loadApiConfig();
    await apiClient.request('/health');

    expect(fetchMock).toHaveBeenCalledWith(`${VALID_API_URL}/health`, expect.anything());
  });
});
