import { describe, expect, it } from 'vitest';

import { ApiError } from '@shared/services';

import { isDynamicImportError } from './dynamicImportError';

function chunkLoadError(): Error {
  const error = new Error('Loading chunk 42 failed.');
  error.name = 'ChunkLoadError';
  return error;
}

describe('isDynamicImportError', () => {
  it.each([
    [
      'Chrome et Edge',
      new TypeError(
        'Failed to fetch dynamically imported module: https://collectionr.test/assets/LoginPage-a1.js',
      ),
    ],
    [
      'Firefox',
      new TypeError(
        'error loading dynamically imported module: https://collectionr.test/assets/LoginPage-a1.js',
      ),
    ],
    ['Safari', new TypeError('Importing a module script failed.')],
    ['le préchargement CSS de Vite', new Error('Unable to preload CSS for /assets/LoginPage.css')],
    ['un ChunkLoadError', chunkLoadError()],
  ])('reconnaît l’échec d’import signalé par %s', (_source, error) => {
    expect(isDynamicImportError(error)).toBe(true);
  });

  it.each([
    ['une erreur de rendu', new TypeError("Cannot read properties of undefined (reading 'name')")],
    ['une erreur d’API', new ApiError({ status: 500, code: 'HTTP_500', message: 'Erreur' })],
    ['une valeur qui n’est pas une erreur', 'Failed to fetch dynamically imported module'],
    ['une valeur absente', undefined],
  ])('ne confond pas %s avec un échec d’import', (_label, error) => {
    expect(isDynamicImportError(error)).toBe(false);
  });
});
