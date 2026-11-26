import { lazy } from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, Link, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createAuthHarness, TEST_USER } from '@shared/hooks/mocks/createAuthHarness';

import { ConnectedLayout } from './ConnectedLayout';
import { PageRoute } from './PageRoute';
import { ROUTES } from './routes';
import { usePageTitle } from './usePageTitle';

function TitledPage() {
  usePageTitle('Ajouter une carte');
  return <Link to={ROUTES.profile}>Vers une page sans titre</Link>;
}

function UntitledPage() {
  return <p>Page sans titre</p>;
}

/** Page dont le fichier ne finit jamais de charger. */
const NeverLoadedPage = lazy(() => new Promise<never>(() => {}));

async function renderLayout(path: string) {
  const harness = createAuthHarness(
    {
      '/auth/refresh': async () => ({ accessToken: 'acces-2', refreshToken: 'renouvellement-2' }),
      '/users/me': async () => TEST_USER,
    },
    'renouvellement-1',
  );
  await act(() => harness.authService.restoreSession());
  const router = createMemoryRouter(
    [
      {
        element: <ConnectedLayout />,
        children: [
          { path: ROUTES.addCard, element: <TitledPage /> },
          { path: ROUTES.profile, element: <UntitledPage /> },
          { path: ROUTES.catalogue, element: <PageRoute page={NeverLoadedPage} /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />, { wrapper: harness.wrapper });
  return router;
}

function topbarTitle() {
  return within(screen.getByRole('banner')).getByRole('heading', { level: 1 });
}

describe('ConnectedLayout', () => {
  it('affiche dans la Topbar et l’onglet le titre fourni par la page', async () => {
    await renderLayout(ROUTES.addCard);

    expect(topbarTitle().textContent).toBe('Ajouter une carte');
    await waitFor(() => expect(document.title).toBe('Ajouter une carte · Collectionr'));
  });

  it('affiche le nom de l’application tant que la page n’a pas fourni son titre', async () => {
    await renderLayout(ROUTES.profile);

    expect(topbarTitle().textContent).toBe('Collectionr');
  });

  it('ne garde jamais le titre de la page précédente', async () => {
    const router = await renderLayout(ROUTES.addCard);

    fireEvent.click(screen.getByRole('link', { name: 'Vers une page sans titre' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.profile));
    expect(topbarTitle().textContent).toBe('Collectionr');
  });

  it('affiche l’utilisateur connecté et la page courante dans la Sidebar', async () => {
    await renderLayout(ROUTES.addCard);

    expect(within(screen.getByRole('banner')).getByRole('img', { name: 'ash' })).toBeTruthy();
    const current = screen.getByRole('link', { name: 'Ajouter une carte' });
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(current.getAttribute('href')).toBe(ROUTES.addCard);
  });

  it('relie chaque lien de la Sidebar à une page de l’application', async () => {
    await renderLayout(ROUTES.addCard);

    const navigation = within(screen.getByRole('navigation', { name: 'Navigation principale' }));
    const hrefs = navigation.getAllByRole('link').map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual([
      ROUTES.dashboard,
      ROUTES.catalogue,
      ROUTES.collections,
      ROUTES.setProgression,
      ROUTES.addCard,
      ROUTES.preGrading,
      ROUTES.profile,
      ROUTES.settings,
    ]);
  });

  it('garde la Sidebar et la Topbar pendant le chargement d’une page', async () => {
    await renderLayout(ROUTES.catalogue);

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy();
    expect(topbarTitle().textContent).toBe('Collectionr');
    expect(within(screen.getByRole('main')).getByRole('status')).toBeTruthy();
  });
});
