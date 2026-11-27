import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from '../services/apiClient';
import { translateAddCardError } from './collectionErrors';

function apiError(status: number) {
  return new ApiError({ status, code: `HTTP_${status}`, message: 'Back message in English' });
}

describe('translateAddCardError', () => {
  it.each([
    [apiError(400), 'Ces informations ont été refusées. Vérifiez la carte, l’état et la quantité.'],
    [apiError(404), 'Cette carte ou cette collection n’existe plus. Rechargez la page.'],
    [apiError(429), 'Trop de tentatives. Réessayez dans quelques minutes.'],
    [apiError(503), 'Le service est momentanément indisponible. Réessayez dans quelques minutes.'],
    [apiError(409), 'La carte n’a pas pu être ajoutée. Réessayez dans un instant.'],
    [
      new NetworkError('connection', 'Requête impossible'),
      'Connexion au serveur impossible. Vérifiez votre connexion internet.',
    ],
    [
      new NetworkError('timeout', 'Requête trop lente'),
      'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
    ],
    [
      new TypeError('Réponse inattendue'),
      'La carte n’a pas pu être ajoutée. Réessayez dans un instant.',
    ],
  ])('traduit %s en français', (error, message) => {
    expect(translateAddCardError(error)).toBe(message);
  });
});
