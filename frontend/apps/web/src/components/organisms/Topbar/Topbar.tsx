import type { ReactNode } from 'react';

import { Avatar, Badge, Icon, Text } from '@/components/atoms';
import type { AvatarProps } from '@/components/atoms';
import { SearchBar } from '@/components/molecules';
import type { SearchBarProps } from '@/components/molecules';

/** Un niveau parent du fil d'Ariane. */
export interface TopbarBreadcrumb {
  /** Intitulé de la page parente. */
  label: string;
  /** Destination de la page parente. */
  href: string;
}

/** Propriétés communes de Topbar, avec ou sans recherche. */
interface TopbarBaseProps {
  /** Titre de la page courante. */
  title: string;
  /** Pages parentes dans l'ordre de navigation. Laisser vide sur une page de premier niveau. */
  breadcrumbs?: readonly TopbarBreadcrumb[];
  /** Nombre entier de notifications non lues. */
  notificationCount: number;
  /** Nom et photo de l'utilisateur. */
  avatar: Pick<AvatarProps, 'name' | 'src'>;
  /** Élément placé avant le titre (bouton « Menu » d'AppLayout sous le seuil desktop). */
  leading?: ReactNode;
}

/**
 * Recherche contrôlée par l'appelant, ou absente : sans recherche globale à brancher, Topbar
 * n'affiche pas de champ qui ne ferait rien.
 */
type TopbarSearchProps =
  | {
      /** Texte de la recherche, contrôlé par l'appelant. */
      searchValue: string;
      /** Appelé quand le texte de recherche change. */
      onSearchChange: SearchBarProps['onChange'];
    }
  | { searchValue?: undefined; onSearchChange?: undefined };

/** Propriétés de Topbar. */
export type TopbarProps = TopbarBaseProps & TopbarSearchProps;

/** Barre supérieure des écrans connectés. */
export function Topbar({
  title,
  breadcrumbs = [],
  searchValue,
  onSearchChange,
  notificationCount,
  avatar,
  leading,
}: TopbarProps) {
  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-space-16 border-b border-lisere bg-ecrin px-space-16 py-space-12 desktop:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 items-center gap-space-12">
        {leading}
        <div className="min-w-0">
          <Text as="h1" variant="h2" truncate>
            {title}
          </Text>
          {breadcrumbs.length > 0 && (
            <nav aria-label="Fil d’Ariane" className="mt-space-4">
              <ol className="flex flex-wrap gap-x-space-8 gap-y-space-4">
                {breadcrumbs.map(({ label, href }) => (
                  <li key={href} className="flex min-w-0 items-center gap-space-8">
                    <a href={href} className="min-w-0 underline decoration-acier-texte">
                      <Text variant="caption" color="acier-texte" truncate>
                        {label}
                      </Text>
                    </a>
                    <span aria-hidden="true">
                      <Text variant="caption" color="acier-texte">
                        /
                      </Text>
                    </span>
                  </li>
                ))}
                <li aria-current="page" className="min-w-0">
                  <Text variant="caption" truncate>
                    {title}
                  </Text>
                </li>
              </ol>
            </nav>
          )}
        </div>
      </div>

      {onSearchChange !== undefined && (
        <div className="col-span-2 row-start-2 mx-auto w-full min-w-0 max-w-topbar-search desktop:col-span-1 desktop:col-start-2 desktop:row-start-1">
          <SearchBar value={searchValue} onChange={onSearchChange} />
        </div>
      )}

      <div className="col-start-2 row-start-1 flex items-center justify-self-end gap-space-16 desktop:col-start-3">
        <span className="relative flex h-space-32 w-space-32 items-center justify-center text-archive">
          <Icon name="bell" label="Notifications" />
          {notificationCount > 0 && (
            <span className="absolute -right-space-8 -top-space-4">
              <Badge
                count={notificationCount}
                aria-label={
                  notificationCount === 1
                    ? '1 notification non lue'
                    : `${notificationCount} notifications non lues`
                }
              />
            </span>
          )}
        </span>
        <Avatar {...avatar} size="md" />
      </div>
    </header>
  );
}
