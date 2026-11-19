/** Propriétés de ProgressBar. */
export interface ProgressBarProps {
  /** Progression courante, ramenée entre 0 et `max`. */
  value: number;
  /** Valeur de complétion (nombre de cartes du set, par exemple) ; 100 par défaut. */
  max?: number;
  /** Nom lu par les lecteurs d'écran (« Progression du set Écarlate et Violet »). */
  'aria-label': string;
}

/** Valeur maximale par défaut : un pourcentage. */
const DEFAULT_MAX = 100;

/** Fond (liséré) de 8 px, sans arrondi ; masque le remplissage qui déborderait. */
const TRACK_CLASSES = 'block h-space-8 w-full overflow-hidden rounded-none bg-lisere';

/** Remplissage pleine largeur, réduit par scaleX depuis la gauche : la transition reste fluide. */
const FILL_CLASSES =
  'block h-full w-full origin-left bg-archive transition-transform duration-signature';

function clamp(value: number, max: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), max);
}

/**
 * Barre de progression (complétion d'un set…), remplissage Archive sur fond liséré.
 * Seule valeur hors classes : l'échelle du remplissage, calculée depuis `value`.
 */
export function ProgressBar({
  value,
  max = DEFAULT_MAX,
  'aria-label': ariaLabel,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 0;
  const current = clamp(value, safeMax);
  const ratio = safeMax === 0 ? 0 : current / safeMax;

  return (
    <span
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={current}
      className={TRACK_CLASSES}
    >
      <span className={FILL_CLASSES} style={{ transform: `scaleX(${ratio})` }} />
    </span>
  );
}
