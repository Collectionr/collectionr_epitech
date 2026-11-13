import { useState } from 'react';

import { fontWeights } from '@shared/tokens';

import { Text } from '../Text';
import type { TextVariant } from '../Text';

/** Tailles autorisées : sm 24 px, md 32 px (wireframe WF-D3), lg 48 px. */
export type AvatarSize = 'sm' | 'md' | 'lg';

/** Propriétés de Avatar. */
export interface AvatarProps {
  /** Nom affiché de l'utilisateur (prénom, ou pseudo à défaut) : source de l'initiale et du libellé. */
  name: string;
  /** Photo de l'utilisateur ; si elle ne charge pas, l'initiale reste affichée. */
  src?: string;
  /** Taille ; md par défaut. */
  size?: AvatarSize;
}

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: 'h-space-24 w-space-24',
  md: 'h-space-32 w-space-32',
  lg: 'h-space-48 w-space-48',
};

const INITIAL_VARIANTS: Record<AvatarSize, Extract<TextVariant, 'caption' | 'body' | 'h2'>> = {
  sm: 'caption',
  md: 'body',
  lg: 'h2',
};

const BOX_CLASSES =
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-lisere bg-ecrin-elevated';

const IMAGE_CLASSES =
  'absolute inset-0 h-full w-full object-cover transition-opacity duration-instant';

/** Première lettre du nom, en majuscule. */
function initialOf(name: string): string {
  return (Array.from(name.trim())[0] ?? '').toLocaleUpperCase('fr-FR');
}

/**
 * Identifie un utilisateur : carré, initiale par défaut, photo en fondu par-dessus une fois chargée.
 * Une photo qui ne charge pas disparaît : l'initiale reste, jamais d'image cassée.
 */
export function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string>();
  const [loadedSrc, setLoadedSrc] = useState<string>();

  const showImage = src !== undefined && src !== failedSrc;
  const imageLoaded = showImage && loadedSrc === src;

  return (
    <span
      className={`${BOX_CLASSES} ${SIZE_CLASSES[size]}`}
      {...(showImage ? {} : { role: 'img', 'aria-label': name })}
    >
      <span aria-hidden="true">
        <Text variant={INITIAL_VARIANTS[size]} weight={fontWeights.bold} as="span">
          {initialOf(name)}
        </Text>
      </span>
      {showImage && (
        <img
          src={src}
          alt={name}
          className={`${IMAGE_CLASSES} ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoadedSrc(src)}
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  );
}
