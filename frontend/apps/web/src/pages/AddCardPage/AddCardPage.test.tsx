import type { ReactNode } from 'react';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readLastCollection, writeLastCollection } from '@/config/lastCollectionStorage';
import { MOCK_CATALOGUE } from '@/mocks/data/catalogue';
import { addCardPath, ROUTES } from '@/router/routes';
import { CatalogServiceContext, CollectionServiceContext } from '@shared/hooks';
import { createAuthHarness, TEST_USER } from '@shared/hooks/mocks/createAuthHarness';
import { ApiError } from '@shared/services';
import type { CatalogService, CollectionService } from '@shared/services';
import { toastStore } from '@shared/stores';
import type { CardEntry, Collection } from '@shared/types';

import { AddCardPage } from './AddCardPage';

const CLASSEUR: Collection = {
  id: 'c1',
  licenceTCGId: 'l1',
  name: 'Classeur Base',
  createdAt: '2026-11-22T10:00:00.000Z',
  updatedAt: '2026-11-22T10:00:00.000Z',
};
const DOUBLES: Collection = { ...CLASSEUR, id: 'c2', name: 'Doubles à échanger' };
const [CHARIZARD] = MOCK_CATALOGUE;

function createdEntry(): CardEntry {
  return {
    id: 'e1',
    collectionId: 'c2',
    cardId: CHARIZARD?.card.id ?? '',
    variantId: null,
    quantity: 1,
    condition: 'LP',
    language: 'fr',
    gradingNote: null,
    notes: null,
    addedAt: '2026-11-26T10:00:00.000Z',
    updatedAt: '2026-11-26T10:00:00.000Z',
  };
}

interface Setup {
  path?: string;
  list?: CollectionService['list'];
  addCard?: CollectionService['addCard'];
}

async function renderPage({
  path = ROUTES.addCard,
  list = async () => [CLASSEUR, DOUBLES],
  addCard = async () => createdEntry(),
}: Setup = {}) {
  const harness = createAuthHarness(
    {
      '/auth/refresh': async () => ({ accessToken: 'acces-2', refreshToken: 'renouvellement-2' }),
      '/users/me': async () => TEST_USER,
    },
    'renouvellement-1',
  );
  await act(() => harness.authService.restoreSession());
  const collectionService = {
    list: vi.fn(list),
    listCards: vi.fn(),
    addCard: vi.fn(addCard),
  } satisfies CollectionService;
  const catalogService = {
    search: vi.fn(async (term: string) =>
      MOCK_CATALOGUE.filter(({ card }) =>
        `${card.nameFr ?? ''} ${card.nameEn}`.toLowerCase().includes(term.toLowerCase()),
      ),
    ),
  } satisfies CatalogService;
  const router = createMemoryRouter(
    [
      { path: ROUTES.addCard, element: <AddCardPage /> },
      { path: ROUTES.collections, element: <p>Page des collections</p> },
      { path: ROUTES.collection, element: <p>Détail de la collection</p> },
      { path: ROUTES.dashboard, element: <p>Page précédente</p> },
    ],
    { initialEntries: [ROUTES.dashboard, path], initialIndex: 1 },
  );
  function Services({ children }: { children: ReactNode }) {
    return harness.wrapper({
      children: (
        <CollectionServiceContext.Provider value={collectionService}>
          <CatalogServiceContext.Provider value={catalogService}>
            {children}
          </CatalogServiceContext.Provider>
        </CollectionServiceContext.Provider>
      ),
    });
  }
  render(<RouterProvider router={router} />, { wrapper: Services });
  return { router, collectionService, catalogService };
}

function collectionField() {
  return screen.findByRole<HTMLSelectElement>('combobox', { name: /^Collection/ });
}

async function chooseCharizard() {
  const input = screen.getByRole('combobox', { name: 'Chercher une carte' });
  fireEvent.change(input, { target: { value: 'dracau' } });
  const option = await screen.findByRole('option', { name: /Dracaufeu.*Set de Base/ });
  fireEvent.click(option);
  return input;
}

afterEach(() => {
  toastStore.getState().clear();
  window.localStorage.clear();
});

describe('AddCardPage', () => {
  it('présélectionne la plus récente des collections et place le focus dans la recherche', async () => {
    await renderPage();

    expect((await collectionField()).value).toBe('c1');
    expect(document.activeElement).toBe(
      screen.getByRole('combobox', { name: 'Chercher une carte' }),
    );
    expect(screen.getByRole('region', { name: 'Aperçu de la carte' }).textContent).toContain(
      'Choisissez une carte',
    );
    expect(document.title).toBe('Ajouter une carte · Collectionr');
  });

  it('présélectionne la collection demandée dans l’adresse', async () => {
    await renderPage({ path: addCardPath('c2') });

    expect((await collectionField()).value).toBe('c2');
  });

  it('présélectionne la dernière collection utilisée, à défaut', async () => {
    writeLastCollection(TEST_USER.id, 'c2');

    await renderPage();

    expect((await collectionField()).value).toBe('c2');
  });

  it('ignore une collection demandée qui n’est pas à l’utilisateur', async () => {
    await renderPage({ path: addCardPath('inconnue') });

    expect((await collectionField()).value).toBe('c1');
  });

  it('propose de créer une collection quand il n’y en a aucune', async () => {
    const { router } = await renderPage({ list: async () => [] });

    expect(await screen.findByText('Aucune collection pour l’instant')).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Créer une collection' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.collections));
  });

  it('signale l’échec du chargement des collections et propose de réessayer', async () => {
    let attempts = 0;
    const { collectionService } = await renderPage({
      list: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ApiError({ status: 403, code: 'Forbidden', message: 'Forbidden' });
        }
        return [CLASSEUR];
      },
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Vos collections n’ont pas pu être chargées.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));

    expect(await collectionField()).toBeTruthy();
    expect(collectionService.list).toHaveBeenCalledTimes(2);
  });

  it('ajoute la carte choisie, confirme, puis reprend la saisie en série', async () => {
    const { collectionService, router } = await renderPage();
    fireEvent.change(await collectionField(), { target: { value: 'c2' } });
    await chooseCharizard();
    const preview = screen.getByRole('region', { name: 'Aperçu de la carte' });
    expect(within(preview).getByRole('heading', { level: 2, name: 'Dracaufeu' })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: /^État/ }), { target: { value: 'LP' } });
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter la quantité' }));
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() => expect(screen.getByText('1 carte ajoutée')).toBeTruthy());
    expect(collectionService.addCard).toHaveBeenCalledWith('c2', {
      cardId: CHARIZARD?.card.id,
      quantity: 2,
      condition: 'LP',
      language: 'fr',
    });
    const [notification] = toastStore.getState().toasts;
    expect(notification).toMatchObject({
      severity: 'success',
      message: 'Dracaufeu ajoutée à “Doubles à échanger”',
    });
    expect(readLastCollection(TEST_USER.id)).toBe('c2');

    const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Chercher une carte' });
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(preview.textContent).toContain('Choisissez une carte');
    expect((await collectionField()).value).toBe('c2');
    expect(screen.getByRole<HTMLSelectElement>('combobox', { name: /^État/ }).value).toBe('LP');
    expect(screen.getByRole<HTMLInputElement>('spinbutton').value).toBe('1');

    act(() => notification?.action?.onAction());
    await waitFor(() => expect(router.state.location.pathname).toBe('/collections/c2'));
  });

  it('garde la saisie et explique l’échec quand l’ajout est refusé', async () => {
    await renderPage({
      addCard: async () => {
        throw new ApiError({ status: 404, code: 'Not Found', message: 'Card not found' });
      },
    });
    await collectionField();
    await chooseCharizard();
    fireEvent.change(screen.getByRole('combobox', { name: /^État/ }), { target: { value: 'NM' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/ }));

    await waitFor(() =>
      expect(toastStore.getState().toasts[0]).toMatchObject({
        severity: 'error',
        message: 'Cette carte ou cette collection n’existe plus. Rechargez la page.',
      }),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Dracaufeu' })).toBeTruthy();
    expect(screen.queryByText(/carte ajoutée/)).toBeNull();
  });

  it('revient à la page précédente avec « Annuler »', async () => {
    const { router } = await renderPage();
    await collectionField();

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(ROUTES.dashboard));
  });
});
