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
  /** Nom accessible quand le champ n'est pas associé à un Label visible. */
  'aria-label'?: string;
  /** Hauteur du champ. La variante compacte affiche un message seulement en cas d'erreur. */
  size?: 'default' | 'compact';
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
  /** Décoration non interactive placée à gauche du champ. */
  leading?: ReactNode;
  /** Élément interactif placé à droite, avec un espace réservé dans le champ. */
  trailing?: ReactNode;
}

/**
 * Une ligne caption insécable : la place du message est réservée même sans erreur.
 * Une seule ligne : voir « Messages d'erreur des champs » dans design-system.md.
 */
const EMPTY_MESSAGE = '\u00A0';

const ROOT_CLASSES = 'flex w-full flex-col gap-space-4';

/** Le survol d'un élément intégré compte comme survol du champ. */
const FIELD_CLASSES = 'group relative';

/**
 * `[&::-ms-reveal]:hidden` masque le bouton œil natif de Microsoft Edge dans un champ mot de passe :
 * PasswordField fournit le sien, sinon deux boutons s'afficheraient côte à côte.
 */
const INPUT_CLASSES =
  'w-full rounded-none border bg-ecrin-elevated px-space-12 text-body text-archive placeholder:text-acier-texte transition-colors duration-instant [&::-ms-reveal]:hidden';

const BORDER_CLASSES = 'border-acier-texte';

/** Sur un contrôle, le liséré se renforce au survol et ne s'affaiblit jamais (design-system.md). */
const HOVER_CLASSES = 'group-hover:border-lisere-active';

/** L'erreur garde sa bordure Alerte, survol compris. */
const ERROR_CLASSES = 'border-alerte';

const DISABLED_CLASSES = 'opacity-disabled';

/** Le même espacement réserve la place du contenu intégré et décale le texte. */
const LEADING_CLASSES =
  'pointer-events-none absolute inset-y-0 left-0 flex w-space-32 items-center justify-center text-acier-texte';
const TRAILING_CLASSES = 'absolute inset-y-0 right-0 flex';

/** En flex, la ligne prend l'interligne de caption et non celui de body, hérité du parent. */
const MESSAGE_CLASSES = 'flex transition-opacity duration-instant';
const MESSAGE_VISIBLE_CLASSES = `${MESSAGE_CLASSES} opacity-100`;
const MESSAGE_HIDDEN_CLASSES = `${MESSAGE_CLASSES} opacity-0`;

/**
 * Champ de saisie texte du design system, rendu par un `<input>` natif.
 * Relie l'erreur au champ par `aria-describedby`. En taille standard, sa place est réservée.
 * Le focus visible reste celui de la règle globale `:focus-visible`.
 */
export function Input({
  id,
  name,
  type = 'text',
  value,
  defaultValue,
  placeholder,
  'aria-label': ariaLabel,
  size = 'default',
  autoComplete,
  required = false,
  disabled = false,
  error,
  onChange,
  onBlur,
  ref,
  leading,
  trailing,
}: InputProps) {
  const hasError = error !== undefined && error !== '';
  const compact = size === 'compact';
  const hasLeading = leading !== undefined;
  const hasTrailing = trailing !== undefined;
  const errorId = `${id}-error`;

  const fieldClassName = [FIELD_CLASSES, disabled && DISABLED_CLASSES].filter(Boolean).join(' ');
  const inputClassName = [
    INPUT_CLASSES,
    compact ? 'h-control-compact' : 'h-control',
    hasError ? ERROR_CLASSES : BORDER_CLASSES,
    !hasError && !disabled && HOVER_CLASSES,
    hasLeading && 'pl-space-32',
    hasTrailing && (compact ? 'pr-space-32' : 'pr-space-48'),
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={ROOT_CLASSES}>
      <div className={fieldClassName}>
        {hasLeading && (
          <span aria-hidden="true" className={LEADING_CLASSES}>
            {leading}
          </span>
        )}
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
          aria-label={ariaLabel}
          aria-invalid={hasError || undefined}
          aria-describedby={hasError ? errorId : undefined}
          onChange={onChange}
          onBlur={onBlur}
          className={inputClassName}
        />
        {hasTrailing && (
          <div className={`${TRAILING_CLASSES} ${compact ? 'w-space-32' : 'w-space-48'}`}>
            {trailing}
          </div>
        )}
      </div>
      {(hasError || !compact) && (
        <p
          id={errorId}
          aria-hidden={hasError ? undefined : true}
          className={hasError ? MESSAGE_VISIBLE_CLASSES : MESSAGE_HIDDEN_CLASSES}
        >
          <Text variant="caption" color="alerte">
            {hasError ? error : EMPTY_MESSAGE}
          </Text>
        </p>
      )}
    </div>
  );
}
