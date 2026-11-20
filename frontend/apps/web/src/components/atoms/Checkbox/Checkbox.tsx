import type { ChangeEventHandler, FocusEventHandler, ReactNode, Ref } from 'react';

import { iconography } from '@shared/tokens';

import { Text } from '../Text';

/** Propriétés de Checkbox. */
export interface CheckboxProps {
  /** Identifiant de la case : sert de base à l'id du message d'erreur. */
  id: string;
  /**
   * Libellé à droite de la case : texte, ou nœud contenant un lien (« J'accepte les CGU »).
   * Un clic sur le lien l'ouvre sans cocher la case.
   */
  label: ReactNode;
  /** Nom du champ dans le formulaire. */
  name?: string;
  /** État d'une case contrôlée. */
  checked?: boolean;
  /** État initial d'une case non contrôlée. */
  defaultChecked?: boolean;
  /** Case obligatoire (attribut natif). */
  required?: boolean;
  /** Désactive la case avec l'attribut natif. */
  disabled?: boolean;
  /** Message d'erreur fourni par le formulaire, affiché sous la case ; Checkbox ne valide rien. */
  error?: string;
  /** Appelé à chaque bascule. */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** Appelé à la sortie de la case. */
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** Référence vers l'`<input>` natif (bibliothèque de formulaire, focus programmé). */
  ref?: Ref<HTMLInputElement>;
}

/** Une ligne caption insécable : la place du message est réservée même sans erreur. */
const EMPTY_MESSAGE = '\u00A0';

/** Caractère sans largeur : donne à l'emplacement de la case la hauteur d'une ligne body. */
const LINE_STRUT = '\u200B';

/** Coche tracée sur la grille 16 × 16 de la case. */
const CHECK_PATH = 'M4 8.5 6.5 11 12 5';

const ROOT_CLASSES = 'flex flex-col gap-space-4';

/** Toute la zone (case + libellé) bascule la case ; `self-start` la limite à son contenu. */
const LABEL_CLASSES = 'group inline-flex self-start items-start gap-space-8';

const DISABLED_CLASSES = 'opacity-disabled';

/** Centre la case sur la première ligne du libellé, même quand il passe à la ligne. */
const BOX_SLOT_CLASSES = 'flex shrink-0 items-center';

const BOX_CLASSES = 'relative flex h-space-16 w-space-16';

/**
 * L'input natif est la case : sémantique, clavier (Espace) et focus global `:focus-visible`
 * restent ceux du navigateur. Cochée : fond et bordure Archive, en `snap` ; retour en `instant`.
 */
const INPUT_CLASSES =
  'peer h-full w-full appearance-none rounded-none border bg-transparent transition-colors duration-instant checked:border-archive checked:bg-archive checked:duration-snap';

const BORDER_CLASSES = 'border-acier-texte';

/** Le liséré se renforce au survol, sauf sur une case cochée, déjà bordée d'Archive. */
const HOVER_CLASSES = 'group-hover:[&:not(:checked)]:border-lisere-active';

const ERROR_CLASSES = 'border-alerte';

/**
 * Tracé normalisé (`pathLength` = 1) : le décalage passe de 1 (caché) à 0 (tracé) au cochage.
 * Le tracé et le décalage sont posés sur le SVG et hérités par le chemin, frère de l'input (`peer`).
 */
const CHECK_CLASSES =
  'pointer-events-none absolute inset-0 h-full w-full fill-none stroke-ecrin [stroke-dasharray:1] [stroke-dashoffset:1] transition-[stroke-dashoffset] duration-instant peer-checked:[stroke-dashoffset:0] peer-checked:duration-snap';

/** En flex, la ligne prend l'interligne de caption et non celui de body, hérité du parent. */
const MESSAGE_CLASSES = 'flex transition-opacity duration-instant';
const MESSAGE_VISIBLE_CLASSES = `${MESSAGE_CLASSES} opacity-100`;
const MESSAGE_HIDDEN_CLASSES = `${MESSAGE_CLASSES} opacity-0`;

/**
 * Case à cocher du design system (CGU…), rendue par un `<input type="checkbox">` natif.
 * Cochée : fond Archive et coche Écrin (décision PO du 16/10/2026), jamais Signal.
 * Affiche l'erreur qu'on lui passe, reliée par `aria-describedby`, dans une place réservée.
 */
export function Checkbox({
  id,
  label,
  name,
  checked,
  defaultChecked,
  required = false,
  disabled = false,
  error,
  onChange,
  onBlur,
  ref,
}: CheckboxProps) {
  const hasError = error !== undefined && error !== '';
  const errorId = `${id}-error`;

  const labelClassName = [LABEL_CLASSES, disabled && DISABLED_CLASSES].filter(Boolean).join(' ');
  const inputClassName = [
    INPUT_CLASSES,
    hasError ? ERROR_CLASSES : BORDER_CLASSES,
    !hasError && !disabled && HOVER_CLASSES,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={ROOT_CLASSES}>
      <label className={labelClassName}>
        <span className={BOX_SLOT_CLASSES}>
          <span aria-hidden="true">
            <Text variant="body" as="span">
              {LINE_STRUT}
            </Text>
          </span>
          <span className={BOX_CLASSES}>
            <input
              ref={ref}
              type="checkbox"
              id={id}
              name={name}
              checked={checked}
              defaultChecked={defaultChecked}
              required={required}
              disabled={disabled}
              aria-invalid={hasError || undefined}
              aria-describedby={hasError ? errorId : undefined}
              onChange={onChange}
              onBlur={onBlur}
              className={inputClassName}
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              strokeWidth={iconography.stroke}
              strokeLinecap="butt"
              strokeLinejoin="miter"
              className={CHECK_CLASSES}
            >
              <path d={CHECK_PATH} pathLength={1} />
            </svg>
          </span>
        </span>
        <Text variant="body" as="span">
          {label}
        </Text>
      </label>
      <p
        id={errorId}
        aria-hidden={hasError ? undefined : true}
        className={hasError ? MESSAGE_VISIBLE_CLASSES : MESSAGE_HIDDEN_CLASSES}
      >
        <Text variant="caption" color="alerte">
          {hasError ? error : EMPTY_MESSAGE}
        </Text>
      </p>
    </div>
  );
}
