import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SidebarDestinations } from '@/components/organisms';

import { AppLayout } from './AppLayout';

/** Ancres : un clic sur un lien ne déclenche pas de navigation (non implémentée par jsdom). */
const destinations: SidebarDestinations = {
  dashboard: '#dashboard',
  catalogue: '#catalogue',
  collection: '#collection',
  setProgression: '#progression',
  addCard: '#ajouter',
  preGrading: '#pre-gradage',
  profile: '#profil',
  settings: '#parametres',
};

function renderLayout() {
  render(
    <AppLayout
      title="Ajouter une carte"
      currentPath={destinations.addCard}
      destinations={destinations}
      user={{ name: 'Camille' }}
    >
      <p>Contenu de la page</p>
      <button type="button">Action de la page</button>
    </AppLayout>,
  );
  const menuButton = screen.getByRole('button', { name: 'Menu' });
  const panelId = menuButton.getAttribute('aria-controls') ?? '';
  const panel = document.getElementById(panelId);
  if (panel === null) {
    throw new Error('Panneau de navigation introuvable');
  }
  return { menuButton, panel };
}

function openMenu(menuButton: HTMLElement) {
  fireEvent.click(menuButton);
}

/**
 * Lien de la navigation, trouvé par son texte : `getByRole` avec un nom calcule le nom accessible
 * de chaque élément et dépasse le délai des tests quand la machine est chargée.
 */
function navigationLink(panel: HTMLElement, name: string): HTMLElement {
  const link = within(panel).getByText(name).closest('a');
  if (link === null) {
    throw new Error(`Lien « ${name} » introuvable`);
  }
  return link;
}

describe('AppLayout', () => {
  it('compose la Sidebar, la Topbar et la zone de contenu', () => {
    renderLayout();

    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy();
    const topbar = within(screen.getByRole('banner'));
    expect(topbar.getByRole('heading', { level: 1, name: 'Ajouter une carte' })).toBeTruthy();
    expect(topbar.getByRole('img', { name: 'Camille' })).toBeTruthy();
    expect(within(screen.getByRole('main')).getByText('Contenu de la page')).toBeTruthy();
  });

  it('n’affiche ni recherche globale ni pastille de notification', () => {
    renderLayout();

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('img', { name: /notification.*non lue/i })).toBeNull();
  });

  it('signale la page courante dans la Sidebar', () => {
    renderLayout();

    const current = screen.getByRole('link', { name: 'Ajouter une carte' });
    expect(current.getAttribute('aria-current')).toBe('page');
  });

  it('fait défiler la zone de contenu seule, sur la hauteur de l’écran', () => {
    const { panel } = renderLayout();

    const root = panel.parentElement;
    expect(root?.classList.contains('h-dvh')).toBe(true);
    expect(root?.classList.contains('overflow-hidden')).toBe(true);
    const main = screen.getByRole('main');
    expect(main.classList.contains('overflow-y-auto')).toBe(true);
    expect(main.classList.contains('min-h-0')).toBe(true);
  });

  it('garde la Sidebar visible au-delà du seuil desktop et la masque en dessous', () => {
    const { menuButton, panel } = renderLayout();

    expect(panel.classList.contains('hidden')).toBe(true);
    expect(panel.classList.contains('desktop:flex')).toBe(true);
    expect(menuButton.parentElement?.classList.contains('desktop:hidden')).toBe(true);
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('ouvre la navigation par-dessus le contenu et y place le focus', () => {
    const { menuButton, panel } = renderLayout();

    openMenu(menuButton);

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    expect(panel.classList.contains('hidden')).toBe(false);
    expect(panel.classList.contains('fixed')).toBe(true);
    expect(document.activeElement).toBe(navigationLink(panel, 'Dashboard'));
  });

  it('se referme avec Échap et rend le focus au bouton Menu', () => {
    const { menuButton, panel } = renderLayout();
    openMenu(menuButton);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
    expect(panel.classList.contains('hidden')).toBe(true);
    expect(document.activeElement).toBe(menuButton);
  });

  it('ignore Échap quand la navigation est fermée', () => {
    const { menuButton } = renderLayout();
    const pageAction = screen.getByRole('button', { name: 'Action de la page' });
    act(() => pageAction.focus());

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(document.activeElement).toBe(pageAction);
    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('reste ouverte sur une autre touche qu’Échap', () => {
    const { menuButton } = renderLayout();
    openMenu(menuButton);

    fireEvent.keyDown(document, { key: 'Tab' });

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('reste ouverte sur un clic dans la navigation hors d’un lien', () => {
    const { menuButton } = renderLayout();
    openMenu(menuButton);

    fireEvent.click(screen.getByRole('heading', { level: 2, name: 'OUTILS' }));

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('se referme au choix d’un lien', () => {
    const { menuButton, panel } = renderLayout();
    openMenu(menuButton);

    fireEvent.click(navigationLink(panel, 'Profil'));

    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('reste ouverte quand le focus passe d’un lien à l’autre', () => {
    const { menuButton, panel } = renderLayout();
    openMenu(menuButton);

    fireEvent.focusOut(navigationLink(panel, 'Dashboard'), {
      relatedTarget: navigationLink(panel, 'Catalogue'),
    });

    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
  });

  it('se referme quand le focus quitte la navigation', () => {
    const { menuButton, panel } = renderLayout();
    openMenu(menuButton);

    fireEvent.focusOut(navigationLink(panel, 'Dashboard'), {
      relatedTarget: screen.getByText('Action de la page'),
    });

    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });

  it('se referme par le bouton Menu, sans se rouvrir quand le focus y revient', () => {
    const { menuButton, panel } = renderLayout();
    openMenu(menuButton);

    fireEvent.focusOut(navigationLink(panel, 'Dashboard'), {
      relatedTarget: menuButton,
    });
    expect(menuButton.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(menuButton);

    expect(menuButton.getAttribute('aria-expanded')).toBe('false');
  });
});
