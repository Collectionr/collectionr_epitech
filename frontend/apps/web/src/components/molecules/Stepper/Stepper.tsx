import { Text } from '@/components/atoms';
import type { TextColor } from '@/components/atoms';
import { fontWeights } from '@shared/tokens';

/** Propriétés de Stepper. */
export interface StepperProps {
  /** Intitulés des étapes, dans l'ordre ; leur nombre fixe le total (une étape au moins). */
  steps: readonly [string, ...string[]];
  /** Étape en cours, numérotée à partir de 1 ; ramenée entre 1 et le nombre d'étapes. */
  currentStep: number;
}

/** État d'une étape, déduit de sa position par rapport à l'étape en cours. */
type StepState = 'completed' | 'current' | 'upcoming';

/** Suffixe lu par les lecteurs d'écran : à l'écran, seul le segment rempli marque une étape complétée. */
const COMPLETED_SUFFIX = ' (complétée)';

const ROOT_CLASSES = 'flex flex-col gap-space-8';

/** Le preflight retire les puces (`list-style: none`) : Safari ne lit plus la liste sans `role="list"`. */
const LIST_CLASSES = 'flex gap-space-4';

const STEP_CLASSES = 'flex flex-1 flex-col gap-space-8';

const SEGMENT_CLASSES = 'block h-space-4 w-full rounded-none transition-colors duration-snap';

const SEGMENT_STATE_CLASSES: Record<StepState, string> = {
  completed: 'bg-archive',
  current: 'bg-archive',
  upcoming: 'bg-lisere',
};

const TITLE_COLORS: Record<StepState, Exclude<TextColor, 'signal'>> = {
  completed: 'acier-texte',
  current: 'archive',
  upcoming: 'acier-texte',
};

const COMPLETED_SUFFIX_CLASSES = 'sr-only';

/** Texte « Étape X sur N » ; le Stepper en est la seule source (voir la JSDoc du composant). */
function formatStepCount(current: number, total: number): string {
  return `Étape ${current} sur ${total}`;
}

/** Ramène l'étape demandée entre 1 et le total : jamais « Étape 3 sur 2 » ni « Étape 0 sur 2 ». */
function clampStep(step: number, total: number): number {
  if (Number.isNaN(step)) {
    return 1;
  }
  return Math.min(Math.max(Math.trunc(step), 1), total);
}

function getStepState(step: number, current: number): StepState {
  if (step < current) {
    return 'completed';
  }
  return step === current ? 'current' : 'upcoming';
}

/**
 * Progression dans un formulaire en plusieurs étapes : « Étape X sur N », puis un segment et un
 * intitulé par étape. Chaque étape est complétée, en cours ou à venir selon sa position par rapport
 * à `currentStep` ; l'étape en cours porte `aria-current="step"`.
 *
 * Purement visuel : ni bouton ni lien. Le formulaire parent pilote l'avancée, le retour et le focus
 * au changement d'étape (SignupForm, COLLR-588 et COLLR-590).
 *
 * Le Stepper est la seule source du texte « Étape X sur N » et du nom de l'étape. COLLR-590
 * prévoit le titre « Étape 2 sur 2 — Sécurité » dans le formulaire : SignupForm garde
 * « Créer votre compte » comme titre unique sur les deux étapes, pour ne répéter ni l'un ni l'autre.
 */
export function Stepper({ steps, currentStep }: StepperProps) {
  const total = steps.length;
  const current = clampStep(currentStep, total);

  return (
    <div className={ROOT_CLASSES}>
      <Text variant="caption" color="acier-texte" as="p">
        {formatStepCount(current, total)}
      </Text>
      <ol role="list" className={LIST_CLASSES}>
        {steps.map((title, index) => {
          const state = getStepState(index + 1, current);
          return (
            // Liste jamais réordonnée : la position est une clé stable, même pour deux intitulés identiques.
            <li
              key={index}
              aria-current={state === 'current' ? 'step' : undefined}
              className={STEP_CLASSES}
            >
              <span
                aria-hidden="true"
                className={`${SEGMENT_CLASSES} ${SEGMENT_STATE_CLASSES[state]}`}
              />
              <Text
                variant="caption"
                color={TITLE_COLORS[state]}
                weight={state === 'current' ? fontWeights.bold : undefined}
              >
                {title}
                {state === 'completed' && (
                  <span className={COMPLETED_SUFFIX_CLASSES}>{COMPLETED_SUFFIX}</span>
                )}
              </Text>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
