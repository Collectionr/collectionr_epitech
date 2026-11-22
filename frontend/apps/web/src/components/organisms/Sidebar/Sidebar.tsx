import { APP_NAME } from '@shared/constants';
import { fontWeights } from '@shared/tokens';

import { Text } from '../../atoms';
import type { IconName } from '../../atoms';
import { NavItem } from '../../molecules';

/** Destinations de la navigation principale fournies par l'application. */
export interface SidebarDestinations {
  /** Tableau de bord. */
  dashboard: string;
  /** Catalogue. */
  catalogue: string;
  /** Collection de l'utilisateur. */
  collection: string;
  /** Progression par set. */
  setProgression: string;
  /** Ajout d'une carte. */
  addCard: string;
  /** Pré-gradage par IA. */
  preGrading: string;
  /** Profil de l'utilisateur. */
  profile: string;
  /** Paramètres du compte. */
  settings: string;
}

/** Propriétés de Sidebar. */
export interface SidebarProps {
  /** Chemin de la page courante, fourni par l'application. */
  currentPath: string;
  /** Chemins des liens de navigation. */
  destinations: SidebarDestinations;
}

interface SidebarItem {
  destination: keyof SidebarDestinations;
  label: string;
  icon: IconName;
}

const SECTIONS: ReadonlyArray<{ title: string | null; items: readonly SidebarItem[] }> = [
  {
    title: null,
    items: [
      { destination: 'dashboard', label: 'Dashboard', icon: 'house' },
      { destination: 'catalogue', label: 'Catalogue', icon: 'grid' },
      { destination: 'collection', label: 'Ma Collection', icon: 'list' },
      { destination: 'setProgression', label: 'Set Progression', icon: 'chart-no-axes-column' },
    ],
  },
  {
    title: 'OUTILS',
    items: [
      { destination: 'addCard', label: 'Ajouter une carte', icon: 'plus' },
      { destination: 'preGrading', label: 'Pré-Gradage IA', icon: 'sparkle' },
    ],
  },
  {
    title: 'COMPTE',
    items: [
      { destination: 'profile', label: 'Profil', icon: 'user-round' },
      { destination: 'settings', label: 'Paramètres', icon: 'settings' },
    ],
  },
];

function normalizePath(path: string): string {
  return path.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
}

/** Navigation latérale des écrans connectés. */
export function Sidebar({ currentPath, destinations }: SidebarProps) {
  const pathname = normalizePath(currentPath);

  return (
    <aside className="w-sidebar flex shrink-0 flex-col border-r border-lisere bg-ecrin pb-space-24">
      <div className="px-space-12 py-space-24">
        <Text as="span" variant="h2" weight={fontWeights.bold}>
          {APP_NAME}
        </Text>
      </div>
      <nav aria-label="Navigation principale" className="flex flex-col gap-space-24">
        {SECTIONS.map(({ title, items }) => (
          <div key={title ?? 'principal'}>
            {title && (
              <div className="px-space-12 pb-space-8">
                <Text as="h2" variant="caption" color="acier-texte" weight={fontWeights.bold}>
                  {title}
                </Text>
              </div>
            )}
            <ul>
              {items.map(({ destination, label, icon }) => {
                const href = destinations[destination];

                return (
                  <li key={destination}>
                    <NavItem
                      href={href}
                      label={label}
                      icon={icon}
                      active={pathname === normalizePath(href)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
