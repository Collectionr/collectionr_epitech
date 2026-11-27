import type { FocusEventHandler, Ref } from 'react';

import { iconography } from '@shared/tokens';

import { Text } from '../Text';

/** Option d'une liste déroulante. */
export interface SelectOption {
  /** Valeur envoyée par le formulaire. */
  value: string;
  /** Intitulé affiché. */
  label: string;
}

/** Propriétés de Select. */
export interface SelectProps {
  /** Identifiant du champ : relie le Label (`htmlFor`) et sert de base à l'id du message d'erreur. */
  id: string;
  /** Nom du champ dans le formulaire. */
  name?: string;
  /** Valeur choisie ; une chaîne vide affiche l'option d'invite. */
  value: string;
  /** Reçoit la valeur choisie. */
  onChange: (value: string) => void;
  /** Options proposées, dans l'ordre d'affichage. */
  options: readonly SelectOption[];
  /** Option d'invite, désactivée, affichée tant que rien n'est choisi (« Choisir un état »). */
  placeholder?: string;
  /** Champ obligatoire (attribut natif) ; l'astérisque visible est porté par Label. */
  required?: boolean;
  /** Désactive le champ avec l'attribut natif. */
  disabled?: boolean;
  /** Message d'erreur fourni par le formulaire, affiché sous le champ ; Select ne valide rien. */
  error?: string;
  /** Appelé à la sortie du champ, moment où le formulaire valide. */
  onBlur?: FocusEventHandler<HTMLSelectElement>;
  /** Référence vers le `<select>` natif (focus programmé). */
  ref?: Ref<HTMLSelectElement>;
}

/** Une ligne caption insécable : la place du message est réservée même sans erreur, comme Input. */
const EMPTY_MESSAGE = ' ';

const ROOT_CLASSES = 'flex w-full flex-col gap-space-4';
const FIELD_CLASSES = 'group relative';

/** Gabarit d'Input : hauteur de contrôle, radius 0, fond ecrin-elevated ; place réservée au chevron. */
const SELECT_CLASSES =
  'h-control w-full appearance-none rounded-none border bg-ecrin-elevated pl-space-12 pr-space-32 text-body text-archive transition-colors duration-instant';

const BORDER_CLASSES = 'border-acier-texte';
/** Sur un contrôle, le liséré se renforce au survol et ne s'affaiblit jamais (design-system.md). */
const HOVER_CLASSES = 'group-hover:border-lisere-active';
/** L'erreur garde sa bordure Alerte, survol compris. */
const ERROR_CLASSES = 'border-alerte';
const DISABLED_CLASSES = 'opacity-disabled';

const CHEVRON_CLASSES =
  'pointer-events-none absolute inset-y-0 right-0 flex w-space-32 items-center justify-center text-acier-texte';

const MESSAGE_CLASSES = 'flex transition-opacity duration-instant';

/**
 * Chevron dessiné ici, sur la grille de 24 px et au trait des icônes (1,5 px, angles vifs) :
 * un atome n'importe que Text, pas Icon.
 */
function Chevron() {
  const size = iconography.sizes.sm;
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={`0 0 ${iconography.grid} ${iconography.grid}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={iconography.stroke}
      strokeLinecap="butt"
      strokeLinejoin="miter"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/**
 * Liste déroulante native du design system, au gabarit d'Input : clavier, lecteurs d'écran et
 * mobile sans effort. Mêmes états qu'Input (défaut, survol, focus, erreur, désactivé) ; l'erreur
 * est reliée au champ par `aria-describedby`, sa place est réservée sous le champ. Le focus
 * visible reste celui de la règle globale `:focus-visible`.
 */
export function Select({
  id,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
  error,
  onBlur,
  ref,
}: SelectProps) {
  const hasError = error !== undefined && error !== '';
  const errorId = `${id}-error`;
  const selectClassName = [
    SELECT_CLASSES,
    hasError ? ERROR_CLASSES : BORDER_CLASSES,
    !hasError && !disabled && HOVER_CLASSES,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={ROOT_CLASSES}>
      <div className={[FIELD_CLASSES, disabled && DISABLED_CLASSES].filter(Boolean).join(' ')}>
        <select
          ref={ref}
          id={id}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          onChange={(event) => onChange(event.currentTarget.value)}
          onBlur={onBlur}
          className={selectClassName}
        >
          {placeholder !== undefined && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className={CHEVRON_CLASSES}>
          <Chevron />
        </span>
      </div>
      <p
        id={errorId}
        aria-hidden={hasError ? undefined : true}
        className={`${MESSAGE_CLASSES} ${hasError ? 'opacity-100' : 'opacity-0'}`}
      >
        <Text variant="caption" color="alerte">
          {hasError ? error : EMPTY_MESSAGE}
        </Text>
      </p>
    </div>
  );
}
