import { useEffect, useState } from 'react';

import { sizing } from '@shared/tokens';
import type { CatalogCard } from '@shared/types';

import { Price, Text } from '../../atoms';
import { CardThumbnail } from '../../molecules';

/** Propriétés de CardPreviewPanel. */
export interface CardPreviewPanelProps {
  /** Carte choisie dans le catalogue, `null` avant toute sélection. */
  selected: CatalogCard | null;
}

const ROOT_CLASSES = 'flex w-full flex-col gap-space-16';

/** Cadre vide au format de la carte, avant sélection. */
const EMPTY_FRAME_CLASSES =
  'flex w-full aspect-card items-center justify-center rounded-card border border-lisere bg-ecrin-elevated p-space-16 text-center';

/**
 * Coins du réticule (motif de verrouillage du Gold Master) : ils partent un peu à l'extérieur de la
 * vignette et s'y verrouillent en `duration-snap` (direct si les animations sont réduites).
 */
const CORNER_BASE_CLASSES =
  'pointer-events-none absolute h-space-12 w-space-12 border-signal transition duration-snap';

const CORNERS = [
  {
    position: '-left-space-4 -top-space-4 border-l border-t',
    away: '-translate-x-space-4 -translate-y-space-4',
  },
  {
    position: '-right-space-4 -top-space-4 border-r border-t',
    away: 'translate-x-space-4 -translate-y-space-4',
  },
  {
    position: '-bottom-space-4 -left-space-4 border-b border-l',
    away: '-translate-x-space-4 translate-y-space-4',
  },
  {
    position: '-bottom-space-4 -right-space-4 border-b border-r',
    away: 'translate-x-space-4 translate-y-space-4',
  },
] as const;

/** Vignette et réticule d'une carte ; remonté à chaque carte choisie, le verrouillage rejoue une fois. */
function LockedThumbnail({ selected }: { selected: CatalogCard }) {
  const [locked, setLocked] = useState(false);

  // Position de départ peinte une première fois, puis transition vers le verrouillage.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setLocked(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="relative">
      <CardThumbnail card={selected.card} set={selected.set} sizes={`${sizing.sidebar}px`} />
      {CORNERS.map(({ position, away }) => (
        <span
          key={position}
          aria-hidden="true"
          className={`${CORNER_BASE_CLASSES} ${position} ${locked ? 'translate-x-0 translate-y-0 opacity-100' : `${away} opacity-0`}`}
        />
      ))}
    </div>
  );
}

/**
 * Aperçu de la carte choisie (panneau droit de WF-D14) : grande vignette, nom, set, numéro et
 * rareté en Data-Mono, prix. Le prix reste « — » tant qu'aucune cote n'existe (pricing en Beta).
 */
export function CardPreviewPanel({ selected }: CardPreviewPanelProps) {
  if (selected === null) {
    return (
      <section aria-label="Aperçu de la carte" className={ROOT_CLASSES}>
        <div className={EMPTY_FRAME_CLASSES}>
          <Text variant="body" color="acier-texte">
            Choisissez une carte pour voir l’aperçu
          </Text>
        </div>
      </section>
    );
  }

  const { card, set } = selected;
  return (
    <section aria-label="Aperçu de la carte" className={ROOT_CLASSES}>
      <LockedThumbnail key={card.id} selected={selected} />
      <div className="flex flex-col gap-space-8">
        <Text as="h2" variant="h2">
          {card.nameFr ?? card.nameEn}
        </Text>
        <Text variant="body" color="acier-texte">
          {set.nameFr ?? set.nameEn}
        </Text>
        <div className="flex flex-wrap items-baseline gap-space-12">
          <Text variant="data">{card.number}</Text>
          {card.rarity !== null && (
            <Text variant="data" color="acier-texte">
              {card.rarity}
            </Text>
          )}
        </div>
        <Price amount={null} />
      </div>
    </section>
  );
}
