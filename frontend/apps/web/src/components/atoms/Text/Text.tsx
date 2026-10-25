import type { ReactNode } from 'react';

import type { fontWeights } from '@shared/tokens';

/** Variantes typographiques issues des tokens (COLLR-573). */
export type TextVariant = 'display' | 'h1' | 'h2' | 'body' | 'caption' | 'data';

/** Variantes sur lesquelles la couleur Signal est autorisée (jamais sous 18 px). */
type SignalVariant = 'display' | 'h1' | 'h2';

/** Couleurs de texte autorisées. */
export type TextColor = 'archive' | 'acier-texte' | 'alerte' | 'ecrin' | 'signal';

/** Graisses Schibsted Grotesk chargées par l'application. */
export type TextWeight =
  | (typeof fontWeights)['normal']
  | (typeof fontWeights)['medium']
  | (typeof fontWeights)['bold']
  | (typeof fontWeights)['extrabold']
  | (typeof fontWeights)['black'];

/** Balises HTML pouvant remplacer la balise par défaut d'une variante. */
export type TextElement = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'label';

/** Propriétés communes à toutes les variantes. */
interface TextBaseProps {
  /** Contenu textuel affiché. */
  children: ReactNode;
  /** Graisse à la place de celle de la variante ; sans effet sur la variante `data`. */
  weight?: TextWeight;
  /** Balise HTML à la place de celle de la variante, pour garder une hiérarchie correcte. */
  as?: TextElement;
  /** Limite le texte à une ligne et ajoute une ellipse. */
  truncate?: boolean;
}

/** Propriétés de Text : Signal n'est accepté que sur display, h1 et h2. */
export type TextProps = TextBaseProps &
  (
    | { variant: SignalVariant; color?: TextColor }
    | { variant: Exclude<TextVariant, SignalVariant>; color?: Exclude<TextColor, 'signal'> }
  );

const DEFAULT_ELEMENTS: Record<TextVariant, TextElement> = {
  display: 'h1',
  h1: 'h1',
  h2: 'h2',
  body: 'p',
  caption: 'span',
  data: 'span',
};

const VARIANT_CLASSES: Record<TextVariant, string> = {
  display: 'text-display',
  h1: 'text-h1',
  h2: 'text-h2',
  body: 'text-body',
  caption: 'text-caption',
  data: 'text-data',
};

const COLOR_CLASSES: Record<TextColor, string> = {
  archive: 'text-archive',
  'acier-texte': 'text-acier-texte',
  alerte: 'text-alerte',
  ecrin: 'text-ecrin',
  signal: 'text-signal',
};

const TRUNCATE_CLASSES = 'block truncate';

/**
 * Affiche du texte avec l'échelle typographique du design system.
 * Taille, interligne, crénage et couleur viennent des tokens ; aucun style libre n'est possible.
 */
export function Text({
  variant,
  color = 'archive',
  weight,
  as,
  truncate = false,
  children,
}: TextProps) {
  const Element = as ?? DEFAULT_ELEMENTS[variant];
  const className = [VARIANT_CLASSES[variant], COLOR_CLASSES[color], truncate && TRUNCATE_CLASSES]
    .filter(Boolean)
    .join(' ');
  const style = variant !== 'data' && weight !== undefined ? { fontWeight: weight } : undefined;

  return (
    <Element className={className} style={style}>
      {children}
    </Element>
  );
}
