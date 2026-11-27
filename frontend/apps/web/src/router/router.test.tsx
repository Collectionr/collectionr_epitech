import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { CatalogServiceContext, CollectionServiceContext } from '@shared/hooks';
import { createAuthHarness, TEST_USER } from '@shared/hooks/mocks/createAuthHarness';
import type { CatalogService, CollectionService } from '@shared/services';

import { appRoutes } from './router';
import { addCardPath, collectionPath, ROUTES } from './routes';

const ROTATED_TOKENS = { accessToken: 'acces-2', refreshToken: 'renouvellement-2' };

/** Services de l'Ajout manuel : aucune collection, aucune carte (seul le titre est vérifié ici). */
const COLLECTION_SERVICE: CollectionService = {
  list: async () => [],
  listCards: async () => ({ items: [], total: 0, page: 1, pageSize: 50 }),
  addCard: () => Promise.reject(new Error('Ajout inattendu')),
};
const CATALOG_SERVICE: CatalogService = { search: async () => [] };

/** Visiteur connecté (session restaurée) ou anonyme (aucun jeton). */
function renderAt(path: string, { connected }: { connected: boolean }) {
  const harness = connected
    ? createAuthHarness(
        { '/auth/refresh': async () => ROTATED_TOKENS, '/users/me': async () => TEST_USER },
        'renouvellement-1',
      )
    : createAuthHarness();
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />, {
    wrapper: ({ children }) =>
      harness.wrapper({
        children: (
          <CollectionServiceContext.Provider value={COLLECTION_SERVICE}>
            <CatalogServiceContext.Provider value={CATALOG_SERVICE}>
              {children}
            </CatalogServiceContext.Provider>
          </CollectionServiceContext.Provider>
        ),
      }),
  });
  return router;
}

describe('routes de l’application', () => {
  it.each([
    [ROUTES.login, 'Connexion', false],
    [ROUTES.signup, 'Inscription', false],
    [ROUTES.forgotPassword, 'Mot de passe oublié', false],
    [ROUTES.dashboard, 'Dashboard', true],
    [ROUTES.collections, 'Ma Collection', true],
    [collectionPath('c1'), 'Collection', true],
    [addCardPath('c1'), 'Ajouter une carte', true],
    [ROUTES.profile, 'Profil', true],
    [ROUTES.catalogue, 'Catalogue', true],
    [ROUTES.setProgression, 'Set Progression', true],
    [ROUTES.preGrading, 'Pré-Gradage IA', true],
    [ROUTES.settings, 'Paramètres', true],
    ['/adresse/inconnue', 'Page introuvable', false],
  ])('affiche %s avec son titre de page et d’onglet', async (path, title, connected) => {
    renderAt(path, { connected });

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined();
    await waitFor(() => expect(document.title).toBe(`${title} · Collectionr`));
  });

  it('affiche une page connectée dans le cadre : titre dans la Topbar, un seul main', async () => {
    renderAt(ROUTES.collections, { connected: true });

    const title = await screen.findByRole('heading', { level: 1, name: 'Ma Collection' });
    expect(screen.getByRole('banner').contains(title)).toBe(true);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeDefined();
  });

  it('affiche une page visiteur hors du cadre, avec son propre titre', async () => {
    renderAt(ROUTES.forgotPassword, { connected: false });

    const title = await screen.findByRole('heading', { level: 1, name: 'Mot de passe oublié' });
    expect(screen.getByRole('main').contains(title)).toBe(true);
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Navigation principale' })).toBeNull();
  });

  it('ramène au Dashboard depuis la page 404', async () => {
    const router = renderAt('/adresse/inconnue', { connected: true });

    fireEvent.click(await screen.findByRole('link', { name: 'Retour au Dashboard' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
    expect(router.state.location.pathname).toBe(ROUTES.dashboard);
  });
});
