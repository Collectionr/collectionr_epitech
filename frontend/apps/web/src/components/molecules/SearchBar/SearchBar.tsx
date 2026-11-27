import { useId, useRef } from 'react';
import type { FocusEventHandler, KeyboardEventHandler, Ref } from 'react';

import { assignRef } from '@/components/assignRef';
import { Icon, Input } from '@/components/atoms';

/** Liste de suggestions pilotée par le champ (motif ARIA combobox). */
export interface SearchBarCombobox {
  /** Id de la liste de suggestions. */
  listboxId: string;
  /** Liste ouverte. */
  expanded: boolean;
  /** Id de la suggestion active, s'il y en a une. */
  activeDescendantId?: string;
}

/** Propriétés de SearchBar. */
export interface SearchBarProps {
  /** Texte affiché dans le champ, contrôlé par le parent. */
  value: string;
  /** Reçoit la valeur à chaque saisie et une chaîne vide à l'effacement. */
  onChange: (value: string) => void;
  /** Nom accessible du champ, « Rechercher » par défaut. */
  label?: string;
  /** Exemple de saisie, « Rechercher... » par défaut. */
  placeholder?: string;
  /** Référence vers l'`<input>` natif (focus programmé). */
  inputRef?: Ref<HTMLInputElement>;
  /** Appelé à chaque touche (navigation d'une liste de suggestions). */
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
  /** Appelé à l'entrée dans le champ. */
  onFocus?: FocusEventHandler<HTMLInputElement>;
  /** Appelé à la sortie du champ. */
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** Nombre de caractères au plus. */
  maxLength?: number;
  /** Id d'un texte d'aide qui décrit le champ. */
  describedBy?: string;
  /** Liste de suggestions pilotée par le champ ; sans elle, simple champ de recherche. */
  combobox?: SearchBarCombobox;
  /** Désactive le champ (envoi en cours) ; la croix d'effacement disparaît. */
  disabled?: boolean;
}

/** Champ de recherche réutilisable à la largeur de son conteneur. */
export function SearchBar({
  value,
  onChange,
  label = 'Rechercher',
  placeholder = 'Rechercher...',
  inputRef,
  onKeyDown,
  onFocus,
  onBlur,
  maxLength,
  describedBy,
  combobox,
  disabled = false,
}: SearchBarProps) {
  const id = useId();
  const ownRef = useRef<HTMLInputElement>(null);

  function setInput(node: HTMLInputElement | null) {
    ownRef.current = node;
    assignRef(inputRef, node);
  }

  function clear() {
    ownRef.current?.focus();
    onChange('');
  }

  return (
    <Input
      id={id}
      ref={setInput}
      size="compact"
      aria-label={label}
      placeholder={placeholder}
      autoComplete={combobox ? 'off' : undefined}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      maxLength={maxLength}
      describedBy={describedBy}
      disabled={disabled}
      {...(combobox && {
        role: 'combobox' as const,
        'aria-expanded': combobox.expanded,
        'aria-controls': combobox.listboxId,
        'aria-activedescendant': combobox.activeDescendantId,
        'aria-autocomplete': 'list' as const,
      })}
      leading={<Icon name="search" size="sm" />}
      trailing={
        value !== '' && !disabled ? (
          <button
            type="button"
            aria-label="Effacer la recherche"
            className="flex w-full items-center justify-center text-acier-texte transition-colors duration-instant hover:text-archive"
            onClick={clear}
          >
            <Icon name="x" size="sm" />
          </button>
        ) : undefined
      }
    />
  );
}
