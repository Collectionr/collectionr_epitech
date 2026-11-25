import { describe, expect, it } from 'vitest';

import { addCardPath, collectionPath, getSafeRedirect, loginPath, ROUTES } from './routes';

describe('chemins', () => {
  it('déclare les routes de l’Alpha', () => {
    expect(ROUTES).toEqual({
      login: '/connexion',
      signup: '/inscription',
      forgotPassword: '/mot-de-passe-oublie',
      dashboard: '/',
      collections: '/collections',
      collection: '/collections/:id',
      addCard: '/cartes/ajouter',
      profile: '/profil',
    });
  });

  it('construit le chemin d’une collection en encodant son identifiant', () => {
    expect(collectionPath('c1')).toBe('/collections/c1');
    expect(collectionPath('base set/1')).toBe('/collections/base%20set%2F1');
  });

  it('construit le chemin d’ajout, avec ou sans collection présélectionnée', () => {
    expect(addCardPath()).toBe('/cartes/ajouter');
    expect(addCardPath('c 1')).toBe('/cartes/ajouter?collection=c+1');
  });

  it('construit le chemin de connexion avec la page demandée', () => {
    expect(loginPath()).toBe('/connexion');
    expect(loginPath('/')).toBe('/connexion');
    expect(loginPath('/collections?tri=nom')).toBe(
      '/connexion?redirect=%2Fcollections%3Ftri%3Dnom',
    );
  });

  it.each(['/profil', '/collections/c1?tri=nom#haut'])(
    'accepte la redirection interne %s',
    (path) => {
      expect(getSafeRedirect(path)).toBe(path);
    },
  );

  it.each([
    null,
    '',
    'profil',
    'https://pirate.example',
    '//pirate.example',
    '/\\pirate.example',
    '/connexion',
    '/inscription?redirect=%2F',
    '/mot-de-passe-oublie',
  ])('refuse la redirection %o', (value) => {
    expect(getSafeRedirect(value)).toBeNull();
  });
});
