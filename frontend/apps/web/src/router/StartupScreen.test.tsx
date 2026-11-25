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
});
