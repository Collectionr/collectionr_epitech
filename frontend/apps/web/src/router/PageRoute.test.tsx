import { lazy } from 'react';

import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOADING_LABEL_DELAY_MS } from './DelayedLoadingLabel';
import { PageRoute } from './PageRoute';

describe('PageRoute', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('n’affiche « Chargement… » qu’au-delà de 400 ms de chargement', () => {
    vi.useFakeTimers();
    const NeverLoadedPage = lazy(() => new Promise<{ default: () => null }>(() => {}));

    render(<PageRoute page={NeverLoadedPage} />);

    expect(screen.getByRole('status').textContent).toBe('');
    act(() => vi.advanceTimersByTime(LOADING_LABEL_DELAY_MS - 1));
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('status').textContent).toBe('Chargement…');
  });

  it('affiche la page une fois chargée', async () => {
    const LoadedPage = lazy(async () => ({ default: () => <h1>Page chargée</h1> }));

    render(<PageRoute page={LoadedPage} />);

    expect(await screen.findByRole('heading', { name: 'Page chargée' })).toBeDefined();
  });

  it('affiche l’écran d’erreur si la page ne peut pas être chargée', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const BrokenPage = lazy(() => Promise.reject(new Error('Fichier de la page introuvable')));

    render(<PageRoute page={BrokenPage} />);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Cette page n’a pas pu s’afficher',
    );
  });
});
