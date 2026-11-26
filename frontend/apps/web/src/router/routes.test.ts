import { describe, expect, it } from 'vitest';

import { addCardPath, collectionPath, getSafeRedirect, loginPath, ROUTES } from './routes';

/** Origine de référence pour relire une valeur renvoyée par `getSafeRedirect`. */
const SITE_ORIGIN = 'https://site.test';

const ACCEPTED_REDIRECTS = ['/profil', '/collections/c1?tri=nom#haut', '/%2F/pirate.example'];

const REFUSED_REDIRECTS = [
  null,
  '',
  'profil',
  'https://pirate.example',
  '//pirate.example',
  '/\\pirate.example',
  '/\t/pirate.example',
  '/\n/pirate.example',
  '/\r\n/pirate.example',
  '//[',
  '/..//pirate.example',
  '/.//pirate.example',
  '/%2e%2e//pirate.example',
  '/a/..//pirate.example',
  '/..\\/pirate.example',
  '/.%2e//pirate.example',
  '/connexion',
  '/inscription?redirect=%2F',
  '/mot-de-passe-oublie',
];

describe('chemins', () => {
  it('déclare les routes de l’Alpha et les pages provisoires de la Sidebar', () => {
    expect(ROUTES).toEqual({
      login: '/connexion',
      signup: '/inscription',
      forgotPassword: '/mot-de-passe-oublie',
      dashboard: '/',
      collections: '/collections',
      collection: '/collections/:id',
      addCard: '/cartes/ajouter',
      profile: '/profil',
      catalogue: '/catalogue',
      setProgression: '/progression',
      preGrading: '/pre-gradage',
      settings: '/parametres',
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

  it.each(ACCEPTED_REDIRECTS)('accepte la redirection interne %s', (path) => {
    expect(getSafeRedirect(path)).toBe(path);
  });

  it.each(REFUSED_REDIRECTS)('refuse la redirection %o', (value) => {
    expect(getSafeRedirect(value)).toBeNull();
  });

  it.each([...ACCEPTED_REDIRECTS, ...REFUSED_REDIRECTS])(
    'ne renvoie jamais pour %o une valeur qui, relue, sort du site',
    (value) => {
      const result = getSafeRedirect(value);
      if (result !== null) {
        expect(new URL(result, SITE_ORIGIN).origin).toBe(SITE_ORIGIN);
      }
    },
  );
});
