import type {
  ChangeEventHandler,
  FocusEventHandler,
  InputHTMLAttributes,
  ReactNode,
  Ref,
} from 'react';

import { Text } from '../Text';

/** Types natifs acceptés ; `password` est réservé à PasswordField (COLLR-582), qui pilote la bascule. */
export type InputType = 'text' | 'email' | 'password';

/** Propriétés de Input. */
export interface InputProps {
  /** Identifiant du champ : relie le Label (`htmlFor`) et sert de base à l'id du message d'erreur. */
  id: string;
  /** Nom du champ dans le formulaire. */
  name?: string;
  /** Type natif ; `text` par défaut. */
  type?: InputType;
  /** Valeur d'un champ contrôlé. */
  value?: string;
  /** Valeur initiale d'un champ non contrôlé. */
  defaultValue?: string;
  /** Exemple de saisie, visible tant que le champ est vide (« email@exemple.com »). */
  placeholder?: string;
  /** Indice d'autocomplétion du navigateur (`email`, `given-name`, `new-password`…). */
  autoComplete?: InputHTMLAttributes<HTMLInputElement>['autoComplete'];
  /** Champ obligatoire (attribut natif) ; l'astérisque visible est porté par Label. */
  required?: boolean;
  /** Désactive le champ avec l'attribut natif. */
  disabled?: boolean;
  /** Message d'erreur fourni par le formulaire, affiché sous le champ ; Input ne valide rien. */
  error?: string;
  /** Appelé à chaque saisie. */
  onChange?: ChangeEventHandler<HTMLInputElement>;
  /** Appelé à la sortie du champ, moment où le formulaire valide. */
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** Référence vers l'`<input>` natif (bibliothèque de formulaire, focus programmé). */
  ref?: Ref<HTMLInputElement>;
  /**
   * Élément placé dans le champ, à droite, sur une largeur `space-48` retirée à la zone de texte.
   * Réservé à PasswordField (bouton afficher/masquer).
   */
  trailing?: ReactNode;
}

/**
 * Une ligne caption insécable : la place du message est réservée même sans erreur.
 * Une seule ligne : voir « Messages d'erreur des champs » dans design-system.md.
 */
const EMPTY_MESSAGE = '\u00A0';

const ROOT_CLASSES = 'flex w-full flex-col gap-space-4';

/** `group` : survoler l'élément intégré (trailing) compte comme survoler le champ. */
const FIELD_CLASSES = 'group relative';

const INPUT_CLASSES =
  'h-control w-full rounded-none border bg-ecrin-elevated px-space-12 text-body text-archive placeholder:text-acier-texte transition-colors duration-instant';

const BORDER_CLASSES = 'border-acier-texte';

/** Sur un contrôle, le liséré se renforce au survol et ne s'affaiblit jamais (design-system.md). */
const HOVER_CLASSES = 'group-hover:border-lisere-active';

/** L'erreur garde sa bordure Alerte, survol compris. */
const ERROR_CLASSES = 'border-alerte';

const DISABLED_CLASSES = 'opacity-disabled';

/** Même token des deux côtés : le texte saisi ne passe jamais sous l'élément intégré. */
const TRAILING_SPACE_CLASSES = 'pr-space-48';
const TRAILING_CLASSES = 'absolute inset-y-0 right-0 flex w-space-48';

/** En flex, la ligne prend l'interligne de caption et non celui de body, hérité du parent. */
const MESSAGE_CLASSES = 'flex transition-opacity duration-instant';
const MESSAGE_VISIBLE_CLASSES = `${MESSAGE_CLASSES} opacity-100`;
const MESSAGE_HIDDEN_CLASSES = `${MESSAGE_CLASSES} opacity-0`;

/**
 * Champ de saisie texte du design system, rendu par un `<input>` natif.
 * Affiche l'erreur qu'on lui passe, reliée par `aria-describedby`, dans une place réservée :
 * l'apparition du message, en fondu, ne décale pas la mise en page.
 * Le focus visible reste celui de la règle globale `:focus-visible`.
 */
export function Input({
  id,
  name,
  type = 'text',
  value,
  defaultValue,
  placeholder,
  autoComplete,
  required = false,
  disabled = false,
  error,
  onChange,
  onBlur,
  ref,
  trailing,
}: InputProps) {
  const hasError = error !== undefined && error !== '';
  const hasTrailing = trailing !== undefined;
  const errorId = `${id}-error`;

  const fieldClassName = [FIELD_CLASSES, disabled && DISABLED_CLASSES].filter(Boolean).join(' ');
  const inputClassName = [
    INPUT_CLASSES,
    hasError ? ERROR_CLASSES : BORDER_CLASSES,
    !hasError && !disabled && HOVER_CLASSES,
    hasTrailing && TRAILING_SPACE_CLASSES,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={ROOT_CLASSES}>
      <div className={fieldClassName}>
        <input
          ref={ref}
          id={id}
          name={name}
          type={type}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          onChange={onChange}
          onBlur={onBlur}
          className={inputClassName}
        />
        {hasTrailing && <div className={TRAILING_CLASSES}>{trailing}</div>}
      </div>
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
