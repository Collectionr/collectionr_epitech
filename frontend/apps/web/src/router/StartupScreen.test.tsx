import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { NetworkError } from '@shared/services';

import { STARTUP_LABEL_DELAY_MS, StartupScreen } from './StartupScreen';

function logoWrapper(): HTMLElement | null {
  return screen.getByText('Collectionr').parentElement;
}

describe('StartupScreen', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fait apparaître le nom en fondu, en durée signature', () => {
    vi.useFakeTimers();
    render(<StartupScreen error={null} onRetry={() => undefined} />);

    expect(logoWrapper()?.className).toContain('opacity-0');
    expect(logoWrapper()?.className).toContain('duration-signature');
    act(() => vi.advanceTimersToNextFrame());

    expect(logoWrapper()?.className).toContain('opacity-100');
  });

  it('n’affiche « Connexion… » qu’au-delà d’1 s', () => {
    vi.useFakeTimers();
    render(<StartupScreen error={null} onRetry={() => undefined} />);

    act(() => vi.advanceTimersByTime(STARTUP_LABEL_DELAY_MS - 1));
    expect(screen.getByRole('status').textContent).toBe('');
    act(() => vi.advanceTimersByTime(1));

    expect(screen.getByRole('status').textContent).toBe('Connexion…');
  });

  it('affiche l’erreur traduite et relance la restauration avec « Réessayer »', () => {
    const onRetry = vi.fn();
    render(
      <StartupScreen error={new NetworkError('connection', 'Failed to fetch')} onRetry={onRetry} />,
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'Connexion au serveur impossible. Vérifiez votre connexion internet.',
    );
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ne déplace pas le focus au premier affichage de l’erreur', () => {
    render(<StartupScreen error={offline()} onRetry={() => undefined} />);

    expect(document.activeElement).toBe(document.body);
  });

  it('remet le focus sur « Réessayer » quand l’essai échoue à son tour', () => {
    const onRetry = vi.fn();
    const { rerender } = render(<StartupScreen error={offline()} onRetry={onRetry} />);

    // fireEvent.click ne donne pas le focus au bouton : seul le composant peut le remettre.
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    rerender(<StartupScreen error={null} onRetry={onRetry} />);
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull();
    rerender(<StartupScreen error={offline()} onRetry={onRetry} />);

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Réessayer' }));
  });

  it('ne reprend le focus qu’après un nouvel appui sur « Réessayer »', () => {
    const { rerender } = render(<StartupScreen error={offline()} onRetry={() => undefined} />);
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    rerender(<StartupScreen error={null} onRetry={() => undefined} />);
    rerender(<StartupScreen error={offline()} onRetry={() => undefined} />);

    // Nouvelle erreur sans appui sur « Réessayer » : le bouton démonté emporte le focus.
    rerender(<StartupScreen error={null} onRetry={() => undefined} />);
    rerender(<StartupScreen error={offline()} onRetry={() => undefined} />);

    expect(document.activeElement).toBe(document.body);
  });
});

function offline(): NetworkError {
  return new NetworkError('connection', 'Failed to fetch');
}
