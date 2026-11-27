import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createAuthHarness, TEST_USER } from '@shared/hooks/mocks/createAuthHarness';
import { ApiError, NetworkError } from '@shared/services';

import { appRoutes } from './router';

const ROTATED_TOKENS = { accessToken: 'acces-2', refreshToken: 'renouvellement-2' };

function renderApp(
  path: string,
  harness: ReturnType<typeof createAuthHarness>,
  { strictMode = false } = {},
) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />, {
    wrapper: harness.wrapper,
    reactStrictMode: strictMode,
  });
  return router;
}

/** Session restaurée au démarrage : jeton enregistré, renouvellement et profil acceptés. */
function connectedHarness() {
  return createAuthHarness(
    {
      '/auth/refresh': async () => ROTATED_TOKENS,
      '/users/me': async () => TEST_USER,
      '/auth/logout': async () => undefined,
    },
    'renouvellement-1',
  );
}

/** Restauration suspendue jusqu'à l'appel de `release`. */
function pendingRestoreHarness() {
  let resolveRefresh: () => void = () => {
    throw new Error('Renouvellement non démarré');
  };
  const harness = createAuthHarness(
    {
      '/auth/refresh': () =>
        new Promise((resolve) => {
          resolveRefresh = () => resolve(ROTATED_TOKENS);
        }),
      '/users/me': async () => TEST_USER,
    },
    'renouvellement-1',
  );
  return {
    harness,
    /** Attend que le renouvellement soit parti, puis le fait aboutir. */
    release: async () => {
      await waitFor(() =>
        expect(harness.client.request).toHaveBeenCalledWith('/auth/refresh', expect.anything()),
      );
      act(() => resolveRefresh());
    },
  };
}

function heading(name: string) {
  return screen.findByRole('heading', { level: 1, name });
}

describe('routes protégées et restauration de session', () => {
  it('redirige un visiteur anonyme vers la connexion, avec la page demandée', async () => {
    const router = renderApp('/collections?tri=nom', createAuthHarness());

    expect(await heading('Connexion')).toBeDefined();
    expect(router.state.location.pathname).toBe('/connexion');
    expect(router.state.location.search).toBe('?redirect=%2Fcollections%3Ftri%3Dnom');
  });

  it('renvoie un utilisateur connecté de la connexion vers le Dashboard', async () => {
    const router = renderApp('/connexion', connectedHarness());

    expect(await heading('Dashboard')).toBeDefined();
    expect(router.state.location.pathname).toBe('/');
  });

  it('renvoie un utilisateur connecté vers la page demandée avant la connexion', async () => {
    const router = renderApp('/connexion?redirect=%2Fprofil', connectedHarness());

    expect(await heading('Profil')).toBeDefined();
    expect(router.state.location.pathname).toBe('/profil');
  });

  it.each(['%2F%2Fpirate.example', 'https%3A%2F%2Fpirate.example', '%2Fconnexion'])(
    'ignore une redirection non sûre (%s) et ouvre le Dashboard',
    async (redirect) => {
      const router = renderApp(`/inscription?redirect=${redirect}`, connectedHarness());

      expect(await heading('Dashboard')).toBeDefined();
      expect(router.state.location.pathname).toBe('/');
    },
  );

  it('redirige vers la connexion avec un message quand la session expire en cours d’usage', async () => {
    const harness = connectedHarness();
    const router = renderApp('/collections', harness);
    expect(await heading('Ma Collection')).toBeDefined();

    // Ce que fait le client API quand le renouvellement est refusé.
    act(() => {
      void harness.authService.clearSession();
    });

    expect(await heading('Connexion')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe(
      'Votre session a expiré, reconnectez-vous.',
    );
    expect(router.state.location.search).toBe('?redirect=%2Fcollections');
  });

  it('garde le message de session expirée sous StrictMode', async () => {
    const harness = connectedHarness();
    renderApp('/collections', harness, { strictMode: true });
    expect(await heading('Ma Collection')).toBeDefined();

    act(() => {
      void harness.authService.clearSession();
    });

    expect(await heading('Connexion')).toBeDefined();
    expect(screen.getByRole('status').textContent).toBe(
      'Votre session a expiré, reconnectez-vous.',
    );
    // Une seule restauration malgré le double montage : le jeton à usage unique n'est présenté qu'une fois.
    expect(
      harness.client.request.mock.calls.filter(([path]) => path === '/auth/refresh'),
    ).toHaveLength(1);
  });

  it('redirige vers la connexion sans page demandée ni message après une déconnexion', async () => {
    const harness = connectedHarness();
    const router = renderApp('/profil', harness);
    expect(await heading('Profil')).toBeDefined();

    await act(() => harness.authService.logout());

    expect(await heading('Connexion')).toBeDefined();
    expect(router.state.location.search).toBe('');
    expect(screen.queryByText('Votre session a expiré, reconnectez-vous.')).toBeNull();
  });

  it('affiche l’écran de démarrage tant que la session est inconnue', async () => {
    const { harness, release } = pendingRestoreHarness();
    renderApp('/collections', harness);

    expect(screen.getByText('Collectionr')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Ma Collection' })).toBeNull();

    await release();
    expect(await heading('Ma Collection')).toBeDefined();
  });

  it('n’affiche pas la connexion à un utilisateur connecté pendant la restauration', async () => {
    const { harness, release } = pendingRestoreHarness();
    const router = renderApp('/connexion', harness);

    expect(screen.getByText('Collectionr')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Connexion' })).toBeNull();

    await release();

    expect(await heading('Dashboard')).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Connexion' })).toBeNull();
    expect(router.state.location.pathname).toBe('/');
  });

  it('propose de réessayer quand le serveur est injoignable au démarrage', async () => {
    let attempts = 0;
    const harness = createAuthHarness(
      {
        '/auth/refresh': async () => {
          attempts += 1;
          if (attempts === 1) {
            throw new NetworkError('connection', 'Failed to fetch');
          }
          return ROTATED_TOKENS;
        },
        '/users/me': async () => TEST_USER,
      },
      'renouvellement-1',
    );
    renderApp('/collections', harness);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'Connexion au serveur impossible. Vérifiez votre connexion internet.',
    );
    expect(harness.storage.current()).toBe('renouvellement-1');
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(await heading('Ma Collection')).toBeDefined();
  });

  it('passe à la connexion, sans écran d’erreur, quand le jeton est refusé', async () => {
    const harness = createAuthHarness(
      {
        '/auth/refresh': () =>
          Promise.reject(new ApiError({ status: 401, code: 'Unauthorized', message: 'Refused' })),
      },
      'renouvellement-revoque',
    );
    renderApp('/collections', harness);

    expect(await heading('Connexion')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    await waitFor(() => expect(harness.storage.current()).toBeNull());
  });
});
