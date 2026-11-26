import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, MouseEvent, ReactNode } from 'react';

import { Button } from '@/components/atoms';
import type { AvatarProps } from '@/components/atoms';
import { Sidebar, Topbar } from '@/components/organisms';
import type { SidebarDestinations, TopbarBreadcrumb } from '@/components/organisms';

/** Propriétés d'AppLayout. */
export interface AppLayoutProps {
  /** Titre de la page courante, transmis par la page et affiché dans la Topbar. */
  title: string;
  /** Pages parentes, affichées dans le fil d'Ariane de la Topbar. */
  breadcrumbs?: readonly TopbarBreadcrumb[];
  /** Chemin de la page courante, fourni par l'application : lien actif de la Sidebar. */
  currentPath: string;
  /** Chemins des liens de la Sidebar. */
  destinations: SidebarDestinations;
  /** Nom et photo de l'utilisateur connecté. */
  user: Pick<AvatarProps, 'name' | 'src'>;
  /** Nombre de notifications non lues ; 0 par défaut (aucune pastille). */
  notificationCount?: number;
  /** Contenu de la page. */
  children: ReactNode;
}

/** Hauteur de l'écran : seule la zone de contenu défile, la Sidebar et la Topbar restent en place. */
const ROOT_CLASSES = 'flex h-dvh overflow-hidden bg-ecrin';

/** Au-delà du seuil desktop, la Sidebar est toujours visible ; en dessous, masquée par défaut. */
const NAVIGATION_CLOSED_CLASSES = 'hidden overflow-y-auto desktop:flex';

/**
 * Sous le seuil desktop, ouverte par « Menu » : par-dessus le contenu, sur toute la hauteur.
 * `z-10` la place devant les éléments positionnés de la page (champs, pastilles).
 */
const NAVIGATION_OPEN_CLASSES = 'fixed inset-y-0 left-0 z-10 flex overflow-y-auto desktop:static';

const COLUMN_CLASSES = 'flex min-w-0 flex-1 flex-col';

/** `min-h-0` : sans lui, l'élément flex grandirait avec son contenu au lieu de défiler. */
const MAIN_CLASSES = 'min-h-0 flex-1 overflow-y-auto';

/** Le bouton « Menu » n'existe que sous le seuil desktop. */
const MENU_BUTTON_SLOT_CLASSES = 'desktop:hidden';

/**
 * Cadre commun des écrans connectés (WF-D3 Dashboard, node Figma 579:50) : Sidebar à gauche,
 * Topbar en haut, zone de contenu qui défile seule. Sidebar et Topbar sont identiques sur tous
 * les écrans : seul le contenu varie. Template pur : aucune donnée, aucune logique de routage,
 * le titre et la page courante sont fournis par l'application.
 *
 * Sous le seuil desktop (1280 px), la Sidebar est masquée ; le bouton « Menu » l'ouvre par-dessus
 * le contenu. Elle se referme avec Échap (le focus revient sur « Menu »), au choix d'un lien ou
 * quand le focus la quitte.
 */
export function AppLayout({
  title,
  breadcrumbs,
  currentPath,
  destinations,
  user,
  notificationCount = 0,
  children,
}: AppLayoutProps) {
  const navigationId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const navigationRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Le panneau passe devant le contenu : le focus y entre à l'ouverture, sur le premier lien.
  useEffect(() => {
    if (menuOpen) {
      navigationRef.current?.querySelector('a')?.focus();
    }
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  function closeOnLinkClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target instanceof Element && event.target.closest('a') !== null) {
      setMenuOpen(false);
    }
  }

  /** Le focus part ailleurs que dans la navigation ou sur « Menu » (qui la referme lui-même). */
  function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget;
    const staysInside =
      next instanceof Node &&
      (event.currentTarget.contains(next) || next === menuButtonRef.current);
    if (!staysInside) {
      setMenuOpen(false);
    }
  }

  return (
    <div className={ROOT_CLASSES}>
      <div
        id={navigationId}
        ref={navigationRef}
        className={menuOpen ? NAVIGATION_OPEN_CLASSES : NAVIGATION_CLOSED_CLASSES}
        onClick={closeOnLinkClick}
        onBlur={closeWhenFocusLeaves}
      >
        <Sidebar currentPath={currentPath} destinations={destinations} />
      </div>
      <div className={COLUMN_CLASSES}>
        <Topbar
          title={title}
          breadcrumbs={breadcrumbs}
          notificationCount={notificationCount}
          avatar={user}
          leading={
            <div className={MENU_BUTTON_SLOT_CLASSES}>
              <Button
                ref={menuButtonRef}
                variant="ghost"
                aria-expanded={menuOpen}
                aria-controls={navigationId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                Menu
              </Button>
            </div>
          }
        />
        <main className={MAIN_CLASSES}>{children}</main>
      </div>
    </div>
  );
}
