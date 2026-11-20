import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { motion } from '@shared/tokens';

import { Text } from '../Text';

/** Propriétés communes du compteur. */
interface CounterBaseProps {
  /** Nombre de cartes prêtes, ramené entre 0 et `total`. */
  ready: number;
  /** Nombre de cartes à traiter. */
  total: number;
  /** Durée totale du traitement en millisecondes, affichée une fois tout prêt (« 1,2 s »). */
  durationMs?: number;
}

/** Une reprise est obligatoire dès qu'un échec peut survenir. */
type CounterFailureProps =
  | { failed?: 0; retryAction?: undefined }
  | {
      /** Nombre de cartes en échec ; signalé par un glyphe et un texte, jamais par la couleur seule. */
      failed: number;
      /** Action de reprise fournie par l'appelant (Button « Réessayer ») ; Counter n'importe que Text. */
      retryAction: ReactNode;
    };

/** Propriétés de Counter. */
export type CounterProps = CounterBaseProps & CounterFailureProps;

/** Une carte de plus par pas : le compteur ne saute jamais plusieurs valeurs d'un coup. */
const STEP_MS = motion.duration.snap;
/** Durée maximale d'un rattrapage, celle d'une carte au balayage : les pas raccourcissent au-delà. */
const CATCH_UP_MS = motion.duration.sequence;

/** Espace de la largeur d'un chiffre : la largeur du compteur reste fixe pendant l'incrément. */
const FIGURE_SPACE = '\u2007';
const NO_BREAK_SPACE = '\u00A0';
const FAILURE_GLYPH = '×';

const SECONDS = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const COUNTER_CLASSES = 'inline-flex items-center gap-space-8';
const VISIBLE_CLASSES = 'whitespace-nowrap';
const ANNOUNCEMENT_CLASSES = 'sr-only';

function clamp(value: number, max: number): number {
  return Number.isNaN(value) ? 0 : Math.min(Math.max(Math.floor(value), 0), max);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** Durée d'un pas pour un écart donné : `snap`, ou moins pour que tout l'écart tienne en `sequence`. */
function stepDuration(gap: number): number {
  return Math.min(STEP_MS, CATCH_UP_MS / gap);
}

function formatDuration(durationMs: number): string {
  return `${SECONDS.format(durationMs / 1000)}${NO_BREAK_SPACE}s`;
}

/**
 * Valeur affichée : avance d'une unité par pas vers la cible, recule ou saute sans délai sinon.
 * La durée du pas est recalculée à chaque nouvelle cible, depuis la valeur affichée.
 */
function useSteppedValue(target: number): number {
  const [displayed, setDisplayed] = useState(target);
  const [previousTarget, setPreviousTarget] = useState(target);
  const [step, setStep] = useState<number>(STEP_MS);

  // Ajustement pendant le rendu (et non dans un effet) : pas de rendu intermédiaire périmé.
  if (target !== previousTarget) {
    setPreviousTarget(target);
    if (target < displayed || prefersReducedMotion()) {
      setDisplayed(target);
    } else {
      setStep(stepDuration(target - displayed));
    }
  }

  useEffect(() => {
    if (displayed >= target) {
      return undefined;
    }
    const timer = window.setTimeout(() => setDisplayed((value) => value + 1), step);
    return () => window.clearTimeout(timer);
  }, [displayed, target, step]);

  return displayed;
}

/**
 * Compteur de progression d'un traitement par lot (scan multi-cartes) : remplace tout spinner.
 * Format Data-Mono `[ 2 / 3 prêtes ]`, puis la durée totale ou les échecs et leur reprise.
 * L'incrément visible est masqué aux lecteurs d'écran : la région annoncée ne contient que les
 * vraies valeurs, pour une seule annonce par changement et non une par pas.
 */
export function Counter({ ready, total, durationMs, failed = 0, retryAction }: CounterProps) {
  const safeTotal = clamp(total, Number.MAX_SAFE_INTEGER);
  const safeReady = clamp(ready, safeTotal);
  const safeFailed = clamp(failed, safeTotal - safeReady);
  const displayed = useSteppedValue(safeReady);

  const hasFailure = safeFailed > 0;
  const failureLabel = `${safeFailed}${NO_BREAK_SPACE}échec${safeFailed > 1 ? 's' : ''}`;
  const isDone = (value: number) => value === safeTotal && safeTotal > 0;

  const announcement = [
    `[ ${safeReady} / ${safeTotal} prêtes ]`,
    ...(isDone(safeReady) && durationMs !== undefined ? [formatDuration(durationMs)] : []),
    ...(hasFailure ? [failureLabel] : []),
  ].join(' · ');

  const width = String(safeTotal).length;
  const progress = `[ ${String(displayed).padStart(width, FIGURE_SPACE)} / ${safeTotal} prêtes ]`;
  const showDuration = isDone(displayed) && durationMs !== undefined;

  return (
    <span className={COUNTER_CLASSES}>
      <span
        role="status"
        aria-live={hasFailure ? 'assertive' : 'polite'}
        aria-atomic="true"
        className={ANNOUNCEMENT_CLASSES}
      >
        {announcement}
      </span>
      <span aria-hidden="true" className={VISIBLE_CLASSES}>
        <Text variant="data">{progress}</Text>
        {showDuration && (
          <Text variant="data" color="acier-texte">
            {` · ${formatDuration(durationMs)}`}
          </Text>
        )}
        {hasFailure && (
          <>
            <Text variant="data" color="acier-texte">
              {' · '}
            </Text>
            <Text variant="data" color="alerte">
              {`${FAILURE_GLYPH} ${failureLabel}`}
            </Text>
          </>
        )}
      </span>
      {hasFailure && (
        <>
          <span aria-hidden="true">
            <Text variant="data" color="acier-texte">
              ·
            </Text>
          </span>
          {retryAction}
        </>
      )}
    </span>
  );
}
