import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Topbar } from './Topbar';
import type { TopbarProps } from './Topbar';

const props: TopbarProps = {
  title: 'Dashboard',
  searchValue: '',
  onSearchChange: () => {},
  notificationCount: 0,
  avatar: { name: 'Camille' },
};

describe('Topbar', () => {
  it('affiche le titre, la recherche, la cloche et l’avatar sur une page de premier niveau', () => {
    render(<Topbar {...props} breadcrumbs={[]} />);

    const topbar = within(screen.getByRole('banner'));
    expect(topbar.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(topbar.getByRole('textbox', { name: 'Rechercher' })).toBeTruthy();
    expect(topbar.getByRole('img', { name: 'Notifications' })).toBeTruthy();
    expect(topbar.getByRole('img', { name: 'Camille' })).toBeTruthy();
    expect(topbar.queryByRole('navigation', { name: 'Fil d’Ariane' })).toBeNull();
    expect(topbar.queryByRole('img', { name: /notification.*non lue/i })).toBeNull();
  });

  it('affiche les pages parentes et le compteur quand la page et les notifications changent', () => {
    const { rerender } = render(<Topbar {...props} />);

    rerender(
      <Topbar
        {...props}
        title="Détail de la carte"
        breadcrumbs={[{ label: 'Catalogue', href: '/catalogue' }]}
        notificationCount={3}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Détail de la carte' })).toBeTruthy();
    const breadcrumb = within(screen.getByRole('navigation', { name: 'Fil d’Ariane' }));
    expect(breadcrumb.getByRole('link', { name: 'Catalogue' }).getAttribute('href')).toBe(
      '/catalogue',
    );
    expect(
      breadcrumb.getByText('Détail de la carte').closest('li')?.getAttribute('aria-current'),
    ).toBe('page');
    expect(screen.getByRole('img', { name: '3 notifications non lues' }).textContent).toBe('3');

    rerender(<Topbar {...props} notificationCount={1} />);
    expect(screen.getByRole('img', { name: '1 notification non lue' })).toBeTruthy();

    rerender(<Topbar {...props} />);
    expect(screen.queryByRole('img', { name: /notification.*non lue/i })).toBeNull();
  });

  it('transmet la saisie et l’effacement à l’appelant', () => {
    const onSearchChange = vi.fn();
    const { rerender } = render(<Topbar {...props} onSearchChange={onSearchChange} />);
    const input = screen.getByRole('textbox', { name: 'Rechercher' });

    fireEvent.change(input, { target: { value: 'Pikachu' } });
    expect(onSearchChange).toHaveBeenNthCalledWith(1, 'Pikachu');

    rerender(<Topbar {...props} searchValue="Pikachu" onSearchChange={onSearchChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));
    expect(onSearchChange).toHaveBeenNthCalledWith(2, '');
  });

  it('n’affiche aucun champ de recherche sans recherche à brancher', () => {
    render(<Topbar title="Dashboard" notificationCount={0} avatar={{ name: 'Camille' }} />);

    const topbar = within(screen.getByRole('banner'));
    expect(topbar.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(topbar.queryByRole('textbox')).toBeNull();
  });

  it('place l’élément fourni avant le titre', () => {
    render(<Topbar {...props} leading={<button type="button">Menu</button>} />);

    const menu = screen.getByRole('button', { name: 'Menu' });
    const title = screen.getByRole('heading', { level: 1, name: 'Dashboard' });
    expect(menu.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
