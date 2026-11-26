import { useState } from 'react';

import type { CardView, SetView } from '@shared/types';

import { Icon, Text } from '../../atoms';
import { cardThumbnailAlt } from './cardThumbnailAlt';

/** Propriétés de CardThumbnail. */
export interface CardThumbnailProps {
  /** Carte du catalogue : image, nom et numéro. */
  card: Pick<CardView, 'nameFr' | 'nameEn' | 'number' | 'imageUrlFr' | 'imageUrlEn'>;
  /** Set de la carte, pour le texte alternatif. */
  set: Pick<SetView, 'nameFr' | 'nameEn'>;
  /**
   * Largeur affichée, pour que le navigateur choisisse la taille d'image (attribut `sizes`) ;
   * toute la largeur de la fenêtre par défaut.
   */
  sizes?: string;
  /** Vignette trop petite pour un texte (liste de suggestions) : glyphe seul en cas d'erreur. */
  compact?: boolean;
}

/** Largeurs des deux tailles d'image servies par TCGdex (`/low.webp`, `/high.webp`). */
const TCGDEX_IMAGE_WIDTHS = { low: 245, high: 600 } as const;

type LoadState = 'loading' | 'loaded' | 'error';

/** Format physique d'une carte, sur toute la largeur fixée par le parent ; liséré 15 %. */
const FRAME_CLASSES =
  'relative w-full aspect-card overflow-hidden rounded-card border border-lisere bg-ecrin-elevated';

/** L'image reste invisible tant qu'elle charge, puis s'affiche nette : jamais de fondu. */
const IMAGE_CLASSES = 'h-full w-full object-cover';

const OVERLAY_CLASSES =
  'absolute inset-0 flex flex-col items-center justify-center gap-space-4 p-space-4 text-acier-texte';

const RETRY_CLASSES = `${OVERLAY_CLASSES} transition-colors duration-instant hover:text-archive`;

/**
 * Vignette d'une carte TCG (planche 08.1 §05.8) : format physique, image française de préférence.
 * Pendant le chargement, un fond plein bordé d'un liséré ; une fois chargée, l'image s'affiche nette.
 * Si elle ne charge pas, un glyphe ✕ et « Réessayer » relancent le chargement. Aucune animation
 * propre : le survol éventuel est porté par le parent.
 */
export function CardThumbnail({ card, set, sizes = '100vw', compact = false }: CardThumbnailProps) {
  const [state, setState] = useState<LoadState>('loading');
  const [attempt, setAttempt] = useState(0);
  const imageUrl = card.imageUrlFr ?? card.imageUrlEn;
  const alt = cardThumbnailAlt(card, set);

  if (imageUrl === null) {
    return (
      <div className={FRAME_CLASSES} role="img" aria-label={`${alt}, image indisponible`}>
        <div aria-hidden="true" className={OVERLAY_CLASSES}>
          <Icon name="x" size="sm" />
          {!compact && (
            <Text variant="caption" color="acier-texte">
              Image indisponible
            </Text>
          )}
        </div>
      </div>
    );
  }

  function retry() {
    setState('loading');
    setAttempt((current) => current + 1);
  }

  return (
    <div className={FRAME_CLASSES}>
      {state !== 'error' && (
        <img
          // Nouvel élément à chaque essai : le navigateur relance le chargement.
          key={attempt}
          src={`${imageUrl}/high.webp`}
          srcSet={`${imageUrl}/low.webp ${TCGDEX_IMAGE_WIDTHS.low}w, ${imageUrl}/high.webp ${TCGDEX_IMAGE_WIDTHS.high}w`}
          sizes={sizes}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={state === 'loaded' ? IMAGE_CLASSES : `${IMAGE_CLASSES} invisible`}
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
      {state === 'error' && (
        <button
          type="button"
          className={RETRY_CLASSES}
          aria-label={`Réessayer le chargement de l’image : ${alt}`}
          onClick={retry}
        >
          <Icon name="x" size="sm" />
          {!compact && (
            <Text as="span" variant="caption">
              Réessayer
            </Text>
          )}
        </button>
      )}
    </div>
  );
}
