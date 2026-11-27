import { describe, expect, it } from 'vitest';

import { ApiError, NetworkError } from '../services/apiClient';
import type { ApiErrorInit } from '../services/apiClient';
import { translateAuthError } from './authErrors';

function apiError(init: Partial<ApiErrorInit> & Pick<ApiErrorInit, 'status'>): ApiError {
  return new ApiError({ code: `HTTP_${init.status}`, message: 'Back message', ...init });
}

describe('translateAuthError', () => {
  it('traduit des identifiants invalides (401)', () => {
    expect(
      translateAuthError(apiError({ status: 401, message: 'Invalid email or password' })),
    ).toEqual({ message: 'Adresse e-mail ou mot de passe incorrect.' });
  });

  it('rattache un e-mail déjà utilisé (409) au champ e-mail', () => {
    expect(
      translateAuthError(apiError({ status: 409, message: 'Email is already registered' })),
    ).toEqual({ message: 'Cette adresse e-mail est déjà utilisée.', field: 'email' });
  });

  it('rattache un pseudo déjà pris (409) au champ pseudo', () => {
    expect(
      translateAuthError(apiError({ status: 409, message: 'Username is already taken' })),
    ).toEqual({ message: 'Ce pseudo est déjà pris.', field: 'username' });
  });

  it('signale des conditions d’utilisation modifiées (409) sans champ', () => {
    expect(
      translateAuthError(
        apiError({
          status: 409,
          message: 'The terms of service have changed; review the current version before accepting',
        }),
      ),
    ).toEqual({
      message: 'Les conditions d’utilisation ont changé : relisez-les avant de les accepter.',
    });
  });

  it('donne un message général pour un autre 409', () => {
    expect(
      translateAuthError(
        apiError({ status: 409, message: 'The resource was modified concurrently' }),
      ),
    ).toEqual({ message: 'Vos informations ont été modifiées entre-temps. Réessayez.' });
  });

  it.each([
    [45, 'Trop de tentatives. Réessayez dans 45 secondes.'],
    [1, 'Trop de tentatives. Réessayez dans 1 seconde.'],
    [60, 'Trop de tentatives. Réessayez dans 1 minute.'],
    [61, 'Trop de tentatives. Réessayez dans 2 minutes.'],
    [900, 'Trop de tentatives. Réessayez dans 15 minutes.'],
  ])('indique le délai d’attente d’un 429 (%i s)', (retryAfterSeconds, message) => {
    expect(translateAuthError(apiError({ status: 429, retryAfterSeconds }))).toEqual({ message });
  });

  it('reste général sur un 429 sans délai', () => {
    expect(translateAuthError(apiError({ status: 429 }))).toEqual({
      message: 'Trop de tentatives. Réessayez dans quelques minutes.',
    });
  });

  it('traduit une saisie refusée (400)', () => {
    expect(translateAuthError(apiError({ status: 400 }))).toEqual({
      message: 'Vérifiez les informations saisies.',
    });
  });

  it.each([
    [503, 'service indisponible'],
    [502, 'passerelle en erreur, back qui redémarre derrière le proxy'],
    [504, 'passerelle sans réponse du back'],
  ])('traduit un %i (%s) en service momentanément indisponible', (status) => {
    expect(translateAuthError(apiError({ status }))).toEqual({
      message: 'Le service est momentanément indisponible. Réessayez dans quelques minutes.',
    });
  });

  it.each([500, 404])('donne un message général pour un %i', (status) => {
    expect(translateAuthError(apiError({ status }))).toEqual({
      message: 'Une erreur est survenue. Réessayez dans un instant.',
    });
  });

  it('traduit un serveur injoignable', () => {
    expect(translateAuthError(new NetworkError('connection', 'Failed to fetch'))).toEqual({
      message: 'Connexion au serveur impossible. Vérifiez votre connexion internet.',
    });
  });

  it('traduit un délai dépassé', () => {
    expect(translateAuthError(new NetworkError('timeout', 'Timeout'))).toEqual({
      message: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
    });
  });

  it('donne un message général pour une erreur inattendue', () => {
    expect(translateAuthError(new TypeError('Réponse inattendue de /auth/login'))).toEqual({
      message: 'Une erreur est survenue. Réessayez dans un instant.',
    });
  });

  it('n’affiche jamais le message anglais du back', () => {
    const { message } = translateAuthError(apiError({ status: 418, message: 'I am a teapot' }));

    expect(message).not.toContain('teapot');
  });
});
