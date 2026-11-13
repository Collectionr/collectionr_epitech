import { Bell, Eye, EyeOff, Icon as LucideIcon, List, Plus, Search } from 'lucide-react';
import type { LucideIcon as LucideIconComponent, LucideIconNode, LucideProps } from 'lucide-react';

import { iconography } from '@shared/tokens';

/** Icônes disponibles. Set ouvert : en ajouter au fil des besoins. */
export type IconName = 'eye' | 'eye-off' | 'search' | 'bell' | 'plus' | 'grid' | 'list';

/** Tailles standard, issues des tokens d'iconographie. */
export type IconSize = keyof typeof iconography.sizes;

/** Propriétés de Icon. */
export interface IconProps {
  /** Icône à afficher. */
  name: IconName;
  /** Taille de l'icône ; md (20 px, boutons et navigation) par défaut. */
  size?: IconSize;
  /**
   * Libellé lu par les lecteurs d'écran, seulement quand l'icône porte seule le sens.
   * Sans libellé, l'icône est décorative et masquée (aria-hidden).
   */
  label?: string;
}

/** Glyphe Lucide, ou tracé dessiné ici sur la grille de 24 px. */
type IconSource = { glyph: LucideIconComponent } | { node: LucideIconNode[] };

const ICONS: Record<IconName, IconSource> = {
  eye: { glyph: Eye },
  'eye-off': { glyph: EyeOff },
  search: { glyph: Search },
  bell: { glyph: Bell },
  plus: { glyph: Plus },
  list: { glyph: List },
  // Dessinée ici parce que les grilles Lucide ont des rectangles arrondis (rx), contraires à la
  // règle des angles vifs du Gold Master §05.2.
  grid: {
    node: [['path', { d: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z', key: 'grid' }]],
  },
};

/**
 * Icône fonctionnelle : trait constant de 1,5 px quelle que soit la taille, angles vifs,
 * terminaisons nettes, sans remplissage. La couleur est héritée du texte parent.
 */
export function Icon({ name, size = 'md', label }: IconProps) {
  const props: LucideProps = {
    size: iconography.sizes[size],
    strokeWidth: iconography.stroke,
    absoluteStrokeWidth: true,
    strokeLinecap: 'butt',
    strokeLinejoin: 'miter',
    ...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label }),
  };

  const source = ICONS[name];
  if ('glyph' in source) {
    const Glyph = source.glyph;
    return <Glyph {...props} />;
  }
  return <LucideIcon iconNode={source.node} {...props} />;
}
