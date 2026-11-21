import { useId, useRef } from 'react';

import { Icon, Input } from '@/components/atoms';

/** Propriétés de SearchBar. */
export interface SearchBarProps {
  /** Texte affiché dans le champ, contrôlé par le parent. */
  value: string;
  /** Reçoit la valeur à chaque saisie et une chaîne vide à l'effacement. */
  onChange: (value: string) => void;
}

/** Champ de recherche réutilisable à la largeur de son conteneur. */
export function SearchBar({ value, onChange }: SearchBarProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    inputRef.current?.focus();
    onChange('');
  }

  return (
    <Input
      id={id}
      ref={inputRef}
      size="compact"
      aria-label="Rechercher"
      placeholder="Rechercher..."
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      leading={<Icon name="search" size="sm" />}
      trailing={
        value !== '' ? (
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
