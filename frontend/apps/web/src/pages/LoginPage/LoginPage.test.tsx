import { onlineManager } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { appRoutes } from '@/router/router';
import { createAuthHarness, TEST_USER } from '@shared/hooks/mocks/createAuthHarness';
import { ApiError, NetworkError } from '@shared/services';
import type { ApiRequestOptions } from '@shared/services';

const SESSION = { user: TEST_USER, accessToken: 'acces-1', refreshToken: 'renouvellement-1' };

type LoginHandler = (options: ApiRequestOptions | undefined) => Promise<unknown>;

/** Visiteur anonyme (aucun jeton) sur la page de connexion, avec le back simulé de `/auth/login`. */
function renderLoginPage(login: LoginHandler, path = '/connexion') {
  const harness = createAuthHarness({ '/auth/login': login });
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  render(<RouterProvider router={router} />, { wrapper: harness.wrapper });
  return { harness, router };
}

async function fillAndSubmit(email: string, password: string) {
  fireEvent.change(await screen.findByLabelText(/Adresse e-mail/), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/^Mot de passe/), { target: { value: password } });
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /^Se connecter/ }));
  });
}

function passwordInput(): HTMLInputElement {
  return screen.getByLabelText(/^Mot de passe/);
}

describe('LoginPage', () => {
  it('affiche le formulaire dans AuthLayout, avec le nom Collectionr côté marque', async () => {
    renderLoginPage(async () => SESSION);

    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    expect(screen.getByRole('complementary').textContent).toBe('Collectionr');
    expect(screen.getByRole('link', { name: 'Inscription' }).getAttribute('href')).toBe(
      '/inscription',
    );
    expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' }).getAttribute('href')).toBe(
      '/mot-de-passe-oublie',
    );
    expect(screen.queryByText('ou')).toBeNull();
  });

  it('connecte l’utilisateur avec l’API puis ouvre le Dashboard', async () => {
    const { harness, router } = renderLoginPage(async () => SESSION);

    await fillAndSubmit('ash@exemple.fr', 'pikachu25');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
    expect(harness.client.request).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'ash@exemple.fr', password: 'pikachu25' },
    });
    expect(router.state.location.pathname).toBe('/');
  });

  it('ouvre la page demandée avant la connexion', async () => {
    const { router } = renderLoginPage(async () => SESSION, '/connexion?redirect=%2Fprofil');

    await fillAndSubmit('ash@exemple.fr', 'pikachu25');

    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/profil');
  });

  it('ignore une page demandée qui mène hors du site et ouvre le Dashboard', async () => {
    const { router } = renderLoginPage(
      async () => SESSION,
      '/connexion?redirect=%2F%09%2Fpirate.example',
    );

    await fillAndSubmit('ash@exemple.fr', 'pikachu25');

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
    expect(router.state.location.pathname).toBe('/');
  });

  it('affiche une erreur explicite, vide le mot de passe et garde l’e-mail en cas d’échec', async () => {
    renderLoginPage(() =>
      Promise.reject(
        new ApiError({ status: 401, code: 'Unauthorized', message: 'Invalid email or password' }),
      ),
    );

    await fillAndSubmit('ash@exemple.fr', 'mauvais-mot-de-passe');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Adresse e-mail ou mot de passe incorrect.',
    );
    await waitFor(() => expect(passwordInput().value).toBe(''));
    expect(screen.getByLabelText<HTMLInputElement>(/Adresse e-mail/).value).toBe('ash@exemple.fr');
    expect(document.activeElement).toBe(passwordInput());
    expect(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
  });

  it('indique le délai d’attente après trop de tentatives', async () => {
    renderLoginPage(() =>
      Promise.reject(
        new ApiError({
          status: 429,
          code: 'Too many requests',
          message: 'Too many requests',
          retryAfterSeconds: 300,
        }),
      ),
    );

    await fillAndSubmit('ash@exemple.fr', 'pikachu25');

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Trop de tentatives. Réessayez dans 5 minutes.',
    );
  });

  describe('hors ligne', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('affiche l’erreur réseau tout de suite et ne relance pas la connexion au retour du réseau', async () => {
      onlineManager.setOnline(false);
      // Ce que fait fetch quand le réseau est coupé.
      const { harness } = renderLoginPage(() =>
        Promise.reject(new NetworkError('connection', 'Failed to fetch')),
      );

      await fillAndSubmit('ash@exemple.fr', 'pikachu25');

      expect((await screen.findByRole('alert')).textContent).toBe(
        'Connexion au serveur impossible. Vérifiez votre connexion internet.',
      );
      await waitFor(() => expect(passwordInput().value).toBe(''));

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(harness.client.request).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
    });
  });

  it('passe le bouton en chargement pendant l’appel réseau', async () => {
    let respond: () => void = () => {
      throw new Error('Connexion non envoyée');
    };
    renderLoginPage(
      () =>
        new Promise((resolve) => {
          respond = () => resolve(SESSION);
        }),
    );

    await fillAndSubmit('ash@exemple.fr', 'pikachu25');

    const button = screen.getByRole<HTMLButtonElement>('button', { name: /^Se connecter/ });
    await waitFor(() => expect(button.getAttribute('aria-busy')).toBe('true'));
    expect(button.disabled).toBe(false);
    act(() => respond());
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeDefined();
  });

  it('signale une session expirée en tête du formulaire', async () => {
    const harness = createAuthHarness(
      {
        '/auth/refresh': async () => ({ accessToken: 'acces-2', refreshToken: 'renouvellement-2' }),
        '/users/me': async () => TEST_USER,
      },
      'renouvellement-1',
    );
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/profil'] });
    render(<RouterProvider router={router} />, { wrapper: harness.wrapper });
    expect(await screen.findByRole('heading', { level: 1, name: 'Profil' })).toBeDefined();

    // Ce que fait le client API quand le renouvellement est refusé en cours d'usage.
    act(() => {
      void harness.authService.clearSession();
    });

    const notice = await screen.findByRole('status');
    expect(notice.textContent).toBe('Votre session a expiré, reconnectez-vous.');
    expect(notice.closest('form')).not.toBeNull();
  });
});
