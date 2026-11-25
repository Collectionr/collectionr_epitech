import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from './api';

describe('resolveApiBaseUrl', () => {
  it.each([undefined, ''])('renvoie /api/v1 quand la valeur est absente (%o)', (value) => {
    expect(resolveApiBaseUrl(value)).toBe('/api/v1');
  });

  it.each(['/api/v1', '/', 'http://localhost:3000/api/v1', 'https://api.exemple.test/v1'])(
    'accepte %s',
    (value) => {
      expect(resolveApiBaseUrl(value)).toBe(value);
    },
  );

  it.each(['api/v1', '//api.exemple.test/v1', 'ftp://api.exemple.test', 'https://'])(
    'refuse %s avec un message explicite',
    (value) => {
      expect(() => resolveApiBaseUrl(value)).toThrow(
        `VITE_API_BASE_URL doit être un chemin commençant par / ou une URL absolue en http:// ou https:// (reçu : "${value}")`,
      );
    },
  );
});
