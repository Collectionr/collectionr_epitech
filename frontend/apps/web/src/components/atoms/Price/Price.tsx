import { formatPercentChange, formatPrice, formatPriceForSpeech } from '@shared/utils';

import { Text } from '../Text';

/** Propriétés de Price. */
export interface PriceProps {
  /** Montant en euros, ou `null` tant qu'aucune cote n'existe (« — », jamais « 0 EUR »). */
  amount: number | null;
  /** Variation relative facultative (0,032 pour une hausse de 3,2 %, -0,032 pour une baisse). */
  change?: number;
  /** Alignement dans une colonne de montants ; à gauche par défaut. */
  align?: 'start' | 'end';
}

const ALIGN_CLASSES: Record<NonNullable<PriceProps['align']>, string> = {
  start: 'inline-flex items-baseline gap-space-8',
  end: 'flex w-full items-baseline justify-end gap-space-8',
};

/** Texte lu à la place du montant et de sa variation, affichés pour les yeux seulement. */
function speechOf(amount: number, change: number | undefined): string {
  const price = formatPriceForSpeech(amount);
  if (change === undefined) {
    return price;
  }
  if (change === 0) {
    return `${price}, stable`;
  }
  const direction = change > 0 ? 'en hausse' : 'en baisse';
  return `${price}, ${direction} de ${formatPercentChange(change)}`;
}

/**
 * Prix et sa variation, en Data-Mono à chiffres tabulaires (« Tout ce qui se mesure s'écrit en
 * mono »). Hausse en Archive avec ↗, baisse en acier-texte avec ↘ : jamais rouge, vert ni Signal.
 * Lu en toutes lettres par les lecteurs d'écran (« 12,40 euros, en hausse de 3,2 % »). Aucune
 * animation : un prix ne clignote pas quand il change.
 */
export function Price({ amount, change, align = 'start' }: PriceProps) {
  if (amount === null) {
    return (
      <span className={ALIGN_CLASSES[align]}>
        <span aria-hidden="true">
          <Text variant="data" color="acier-texte">
            —
          </Text>
        </span>
        <span className="sr-only">Prix indisponible</span>
      </span>
    );
  }

  const rising = change !== undefined && change > 0;
  const falling = change !== undefined && change < 0;

  return (
    <span className={ALIGN_CLASSES[align]}>
      <span aria-hidden="true" className={ALIGN_CLASSES.start}>
        <Text variant="data">{formatPrice(amount)}</Text>
        {change !== undefined && (
          <Text variant="data" color={falling || change === 0 ? 'acier-texte' : 'archive'}>
            {rising && '↗ '}
            {falling && '↘ '}
            {formatPercentChange(change)}
          </Text>
        )}
      </span>
      <span className="sr-only">{speechOf(amount, change)}</span>
    </span>
  );
}
