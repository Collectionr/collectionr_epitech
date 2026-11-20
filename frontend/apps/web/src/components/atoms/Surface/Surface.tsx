import type { ReactNode } from 'react';

import type { spacing } from '@shared/tokens';

/** Espacements internes autorisés, issus des tokens d'espacement (COLLR-573). */
export type SurfacePadding = Extract<
  keyof typeof spacing,
  'space-12' | 'space-16' | 'space-24' | 'space-32'
>;

/** Balises HTML pouvant porter la surface. */
export type SurfaceElement = 'div' | 'section' | 'article' | 'li';

/** Propriétés de Surface. */
export interface SurfaceProps {
  /** Contenu affiché sur la surface. */
  children: ReactNode;
  /** Espacement interne ; aucun par défaut. */
  padding?: SurfacePadding;
  /** Balise HTML de la surface, `li` dans une liste de cartes par exemple. */
  as?: SurfaceElement;
}

const PADDING_CLASSES: Record<SurfacePadding, string> = {
  'space-12': 'p-space-12',
  'space-16': 'p-space-16',
  'space-24': 'p-space-24',
  'space-32': 'p-space-32',
};

const SURFACE_CLASSES = 'bg-ecrin-elevated rounded-card border border-lisere';

/**
 * Fond de carte générique : fond élevé, arrondi de carte et liséré, sans ombre.
 * Aucun état interactif : la molecule qui rend la carte cliquable ajoute son propre hover.
 */
export function Surface({ padding, as: Element = 'div', children }: SurfaceProps) {
  const className = [SURFACE_CLASSES, padding && PADDING_CLASSES[padding]]
    .filter(Boolean)
    .join(' ');

  return <Element className={className}>{children}</Element>;
}
