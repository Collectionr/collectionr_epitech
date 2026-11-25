import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RouteErrorBoundary } from './RouteErrorBoundary';

/** Composant dont le rendu échoue tant que `state.broken` est vrai. */
function createFragileChild() {
  const state = { broken: true };
  function FragileChild() {
    if (state.broken) {
      throw new Error('Rendu impossible');
    }
    return <p>Contenu de la page</p>;
  }
  return { state, FragileChild };
}

describe('RouteErrorBoundary', () => {
  beforeEach(() => {
    // React journalise chaque erreur interceptée par une boundary : bruit attendu dans ces tests.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('affiche la route quand elle ne lève aucune erreur', () => {
    render(
      <RouteErrorBoundary>
        <p>Contenu de la page</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText('Contenu de la page')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('remplace la route en erreur par un écran d’erreur avec « Réessayer »', () => {
    const { FragileChild } = createFragileChild();

    render(
      <RouteErrorBoundary>
        <FragileChild />
      </RouteErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Cette page n’a pas pu s’afficher');
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeDefined();
  });

  it('rend la route à nouveau au clic sur « Réessayer »', () => {
    const { state, FragileChild } = createFragileChild();
    render(
      <RouteErrorBoundary>
        <FragileChild />
      </RouteErrorBoundary>,
    );

    state.broken = false;
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(screen.getByText('Contenu de la page')).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('relance la requête en erreur au clic sur « Réessayer »', async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('Serveur indisponible'))
      .mockResolvedValueOnce('Données reçues');
    function PageWithQuery() {
      const { data } = useQuery({ queryKey: ['page'], queryFn, throwOnError: true });
      return <p>{data ?? 'Chargement'}</p>;
    }
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RouteErrorBoundary>
          <PageWithQuery />
        </RouteErrorBoundary>
      </QueryClientProvider>,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Réessayer' }));

    expect(await screen.findByText('Données reçues')).toBeDefined();
    expect(queryFn).toHaveBeenCalledTimes(2);
  });
});
