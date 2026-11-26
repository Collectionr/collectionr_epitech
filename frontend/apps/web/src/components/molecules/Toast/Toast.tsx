import { useEffect, useRef, useState } from 'react';

import { TOAST_DURATION_MS } from '@shared/stores';
import type { ToastItem, ToastSeverity } from '@shared/stores';
import { motion } from '@shared/tokens';

import { Button, Icon, Text } from '../../atoms';
import type { TextColor } from '../../atoms';

/** Propriétés de Toast. */
export interface ToastProps {
  /** Notification affichée. */
  toast: ToastItem;
  /** Appelé quand la notification se ferme : bouton, action, ou fin de sa durée. */
  onDismiss: (id: number) => void;
}

/** Glyphe, couleur et libellé lu de chaque sévérité : jamais la couleur seule, jamais de vert. */
const SEVERITIES: Record<
  ToastSeverity,
  { glyph: string; color: Exclude<TextColor, 'signal'>; spoken: string }
> = {
  success: { glyph: '✓', color: 'archive', spoken: 'Succès' },
  info: { glyph: 'i', color: 'acier-texte', spoken: 'Information' },
  error: { glyph: '!', color: 'alerte', spoken: 'Erreur' },
};

/** Fond ecrin-elevated, liséré, radius 0 ; la transition porte l'entrée et la sortie. */
const BASE_CLASSES =
  'flex w-full items-start gap-space-12 rounded-none border border-lisere bg-ecrin-elevated p-space-12 transition';

/** Entrée : glissement de 8 px et fondu en `duration-snap` (direct si les animations sont réduites). */
const ENTERING_CLASSES = 'translate-y-space-8 opacity-0 duration-snap';
const SHOWN_CLASSES = 'translate-y-0 opacity-100 duration-snap';
/** Sortie : fondu en `duration-instant`. */
const LEAVING_CLASSES = 'opacity-0 duration-instant';

type Phase = 'entering' | 'shown' | 'leaving';

const PHASE_CLASSES: Record<Phase, string> = {
  entering: ENTERING_CLASSES,
  shown: SHOWN_CLASSES,
  leaving: LEAVING_CLASSES,
};

/**
 * Notification (WF-D10) : glyphe de sévérité, message, action facultative et bouton de fermeture.
 * Un succès ou une information se ferme après 4 s ; le minuteur est en pause au survol et quand
 * le focus clavier est dans la notification. Une erreur reste jusqu'à sa fermeture.
 * `role="status"` pour un succès ou une information, `role="alert"` pour une erreur.
 */
export function Toast({ toast, onDismiss }: ToastProps) {
  const { id, severity, message, action } = toast;
  const { glyph, color, spoken } = SEVERITIES[severity];
  const [phase, setPhase] = useState<Phase>('entering');
  const [paused, setPaused] = useState(false);
  /** Temps restant avant la fermeture automatique, décompté seulement hors pause. */
  const remainingMs = useRef(TOAST_DURATION_MS);
  const autoDismiss = severity !== 'error';

  // L'état d'entrée est peint une première fois, puis la transition l'amène à l'état visible.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setPhase('shown'));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (phase !== 'leaving') {
      return undefined;
    }
    const timer = setTimeout(() => onDismiss(id), motion.duration.instant);
    return () => clearTimeout(timer);
  }, [phase, id, onDismiss]);

  useEffect(() => {
    if (!autoDismiss || paused || phase === 'leaving') {
      return undefined;
    }
    const startedAt = Date.now();
    const timer = setTimeout(() => setPhase('leaving'), remainingMs.current);
    return () => {
      clearTimeout(timer);
      remainingMs.current -= Date.now() - startedAt;
    };
  }, [autoDismiss, paused, phase]);

  function close() {
    setPhase('leaving');
  }

  return (
    <div
      role={severity === 'error' ? 'alert' : 'status'}
      className={`${BASE_CLASSES} ${PHASE_CLASSES[phase]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setPaused(false);
        }
      }}
    >
      <span aria-hidden="true" className="flex w-space-16 shrink-0 justify-center">
        <Text variant="data" color={color}>
          {glyph}
        </Text>
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-space-8">
        <Text variant="body">
          <span className="sr-only">{spoken} : </span>
          {message}
        </Text>
        {action !== undefined && (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                action.onAction();
                close();
              }}
            >
              {action.label}
            </Button>
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="Fermer la notification"
        className="flex shrink-0 text-acier-texte transition-colors duration-instant hover:text-archive"
        onClick={close}
      >
        <Icon name="x" size="sm" />
      </button>
    </div>
  );
}
