import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { appRoutes } from './router';
import { addCardPath, collectionPath, ROUTES } from './routes';

function renderAt(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe('routes de l’application', () => {
  it.each([
    [ROUTES.login, 'Connexion'],
    [ROUTES.signup, 'Inscription'],
    [ROUTES.forgotPassword, 'Mot de passe oublié'],
    [ROUTES.dashboard, 'Dashboard'],
    [ROUTES.collections, 'Ma Collection'],
    [collectionPath('c1'), 'Collection'],
    [addCardPath('c1'), 'Ajouter une carte'],
    [ROUTES.profile, 'Profil'],
    ['/adresse/inconnue', 'Page introuvable'],
  ])('affiche %s avec son titre de page et d’onglet', async (path, title) => {
    renderAt(path);

    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeDefined();
    await waitFor(() => expect(document.title).toBe(`${title} · Collectionr`));
  });

  it('ramène au Dashboard depuis la page 404', async () => {
    const router = renderAt('/adresse/inconnue');

    fireEvent.click(await screen.findByRole('link', { name: 'Retour au Dashboard' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
    expect(router.state.location.pathname).toBe(ROUTES.dashboard);
  });
});
