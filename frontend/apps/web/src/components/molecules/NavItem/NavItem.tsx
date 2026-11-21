import { fontWeights } from '@shared/tokens';

import { Icon, Text } from '../../atoms';
import type { IconName } from '../../atoms';

/** Propriétés de NavItem. */
export interface NavItemProps {
  /** Destination du lien. */
  href: string;
  /** Intitulé du lien, utilisé comme nom accessible. */
  label: string;
  /** Icône décorative associée à la destination. */
  icon: IconName;
  /** Indique si la destination est la page courante. */
  active?: boolean;
}

/** Lien de navigation à la largeur de son conteneur. */
export function NavItem({ href, label, icon, active = false }: NavItemProps) {
  const stateClasses = active
    ? 'border-signal bg-ecrin-elevated text-archive'
    : 'border-transparent text-acier-texte hover:bg-ecrin-elevated';

  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex h-control w-full items-center gap-space-8 border-l-nav-indicator px-space-12 transition-colors duration-instant ${stateClasses}`}
    >
      <span className="shrink-0">
        <Icon name={icon} />
      </span>
      <Text
        as="span"
        variant="body"
        color={active ? 'archive' : 'acier-texte'}
        weight={active ? fontWeights.bold : undefined}
        truncate
      >
        {label}
      </Text>
    </a>
  );
}
