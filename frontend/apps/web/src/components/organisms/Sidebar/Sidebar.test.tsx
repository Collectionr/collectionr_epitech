import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sidebar } from '..';
import type { SidebarDestinations } from '..';

const destinations: SidebarDestinations = {
  dashboard: '/',
  catalogue: '/catalogue',
  collection: '/collection',
  setProgression: '/sets/progression',
  addCard: '/collection/ajouter',
  preGrading: '/pre-gradage',
  profile: '/profil',
  settings: '/parametres',
};

describe('Sidebar', () => {
  it('affiche Collectionr et les huit liens dans les trois sections ordonnées', () => {
    render(<Sidebar currentPath={destinations.dashboard} destinations={destinations} />);

    expect(screen.getByText('Collectionr')).toBeTruthy();
    const nav = within(screen.getByRole('navigation', { name: 'Navigation principale' }));
    expect(nav.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'OUTILS',
      'COMPTE',
    ]);
    expect(
      nav.getAllByRole('list').map((list) =>
        within(list)
          .getAllByRole('link')
          .map((link) => [link.textContent, link.getAttribute('href')]),
      ),
    ).toEqual([
      [
        ['Dashboard', destinations.dashboard],
        ['Catalogue', destinations.catalogue],
        ['Ma Collection', destinations.collection],
        ['Set Progression', destinations.setProgression],
      ],
      [
        ['Ajouter une carte', destinations.addCard],
        ['Pré-Gradage IA', destinations.preGrading],
      ],
      [
        ['Profil', destinations.profile],
        ['Paramètres', destinations.settings],
      ],
    ]);
  });

  it('signale uniquement le lien de la page courante et le met à jour quand la route change', () => {
    const { rerender } = render(<Sidebar currentPath="/" destinations={destinations} />);
    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('Dashboard');

    rerender(
      <Sidebar currentPath="/collection/ajouter/?source=menu#form" destinations={destinations} />,
    );
    expect(screen.getByRole('link', { current: 'page' }).textContent).toBe('Ajouter une carte');
    expect(
      screen.getByRole('link', { name: 'Ma Collection' }).getAttribute('aria-current'),
    ).toBeNull();

    rerender(<Sidebar currentPath="/catalogue/carte/123" destinations={destinations} />);
    expect(screen.queryByRole('link', { current: 'page' })).toBeNull();
  });
});
