import { Text } from '../Text';

/** Propriétés de Badge. */
export interface BadgeProps {
  /** Nombre affiché ; arrondi à l'entier inférieur, rien n'est rendu en dessous de 1. */
  count: number;
  /** Phrase lue par les lecteurs d'écran, le chiffre seul ne suffisant pas (« 3 notifications non lues »). */
  'aria-label': string;
}

/** Au-delà, le badge affiche « 99+ » pour garder une largeur bornée. */
const MAX_COUNT = 99;

/** Carré de 20 px pour un chiffre, élargi par le padding au-delà ; fondu à l'apparition. */
const BADGE_CLASSES =
  'inline-flex h-badge min-w-badge animate-fade-in items-center justify-center rounded-none bg-archive px-space-4';

/** Le chiffre est remonté à chaque changement de valeur, ce qui rejoue le fondu. */
const VALUE_CLASSES = 'animate-fade-in';

/**
 * Compteur carré (notifications non lues, doublons…), fond Archive et chiffre Écrin.
 * Son placement (coin d'une icône, fin de ligne) est laissé au parent.
 */
export function Badge({ count, 'aria-label': ariaLabel }: BadgeProps) {
  const value = Math.floor(count);
  if (Number.isNaN(value) || value < 1) {
    return null;
  }
  const display = value > MAX_COUNT ? `${MAX_COUNT}+` : String(value);

  return (
    <span role="img" aria-label={ariaLabel} className={BADGE_CLASSES}>
      <span key={display} className={VALUE_CLASSES}>
        <Text variant="data" color="ecrin">
          {display}
        </Text>
      </span>
    </span>
  );
}
