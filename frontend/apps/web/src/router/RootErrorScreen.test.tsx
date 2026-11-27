import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { RouteObject } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createAuthHarness } from '@shared/hooks/mocks/createAuthHarness';

import { RootErrorScreen } from './RootErrorScreen';
import { appRoutes } from './router';
import { ROUTES } from './routes';

/** Garde dont le rendu échoue : une erreur levée au-dessus des pages. */
function BrokenGuard(): never {
  throw new Error('Garde en erreur');
}

describe('RootErrorScreen', () => {
  beforeEach(() => {
    // React et React Router journalisent chaque erreur interceptée : bruit attendu dans ces tests.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('remplace l’écran technique de React Router quand une erreur sort des pages', async () => {
    // La vraie route racine (RootLayout et son errorElement), avec une garde en erreur pour enfant.
    const [root] = appRoutes as [RouteObject];
    const router = createMemoryRouter([
      {
        element: root.element,
        errorElement: root.errorElement,
        children: [{ path: '/', element: <BrokenGuard /> }],
      },
    ]);

    render(<RouterProvider router={router} />, { wrapper: createAuthHarness().wrapper });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Une erreur est survenue');
    expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
    expect(screen.queryByText('Garde en erreur')).toBeNull();
    await waitFor(() => expect(document.title).toBe('Erreur · Collectionr'));
  });

  it('recharge la page au clic sur « Recharger la page »', () => {
    const reload = vi.fn();
    render(<RootErrorScreen reload={reload} />);

    fireEvent.click(screen.getByRole('button', { name: 'Recharger la page' }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('propose de revenir au Dashboard par un lien qui recharge l’application', () => {
    render(<RootErrorScreen />);

    expect(screen.getByRole('link', { name: 'Retour au Dashboard' }).getAttribute('href')).toBe(
      ROUTES.dashboard,
    );
  });
});
