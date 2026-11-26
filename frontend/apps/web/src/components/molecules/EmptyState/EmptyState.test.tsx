import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('affiche le titre, la précision et l’action suggérée d’une liste vide', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Aucune carte dans cette collection"
        description="Ajoutez votre première carte pour commencer."
        action={{ label: 'Ajouter une carte', onClick }}
      />,
    );

    expect(screen.getByText('Aucune carte dans cette collection')).toBeTruthy();
    expect(screen.getByText('Ajoutez votre première carte pour commencer.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter une carte' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('n’affiche ni précision, ni icône, ni bouton quand ils ne sont pas fournis', () => {
    const { container } = render(<EmptyState title="Aucune collection" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
    expect(container.textContent).toBe('Aucune collection');
  });

  it('propose d’effacer la recherche quand elle n’a rien trouvé', () => {
    const onClearSearch = vi.fn();
    render(
      <EmptyState
        variant="no-results"
        icon="search"
        title="Aucune carte trouvée pour “zzz”"
        onClearSearch={onClearSearch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });

  it('montre une recherche sans résultat sans bouton quand rien n’est à effacer', () => {
    render(<EmptyState variant="no-results" title="Aucun résultat" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('affiche l’icône fournie, décorative', () => {
    const { container } = render(<EmptyState icon="list" title="Aucune carte" />);

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('se centre, limite sa largeur de lecture et apparaît en fondu', () => {
    const { container } = render(<EmptyState title="Aucune carte" />);

    const root = container.firstElementChild;
    for (const name of [
      'mx-auto',
      'max-w-form',
      'items-center',
      'text-center',
      'animate-fade-in',
    ]) {
      expect(root?.classList.contains(name)).toBe(true);
    }
  });
});
