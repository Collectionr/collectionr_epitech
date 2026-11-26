import { useState } from 'react';
import type { KeyboardEvent } from 'react';

import { CARD_ENTRY_QUANTITY } from '@shared/constants';

import { Text } from '../../atoms';

/** Propriétés de QuantityStepper. */
export interface QuantityStepperProps {
  /** Id du champ, relié au Label par FormField. */
  id?: string;
  /** Quantité courante. */
  value: number;
  /** Reçoit la nouvelle quantité, toujours comprise entre `min` et `max`. */
  onChange: (value: number) => void;
  /** Minimum, 1 par défaut (borne du back). */
  min?: number;
  /** Maximum, 9999 par défaut (borne du back, `CARD_ENTRY_QUANTITY`). */
  max?: number;
  /** Désactive les boutons et le champ. */
  disabled?: boolean;
  /** Champ obligatoire, transmis par FormField. */
  required?: boolean;
}

const ROOT_CLASSES = 'flex items-stretch';

/** Retour par le liséré uniquement, sans rebond ni pression. */
const BUTTON_CLASSES =
  'flex h-control min-w-control items-center justify-center rounded-none border border-acier-texte bg-transparent text-archive transition-colors duration-instant active:border-lisere-active disabled:opacity-disabled';

/** Data-Mono à chiffres tabulaires : la largeur ne bouge pas de 9 à 10. */
const INPUT_CLASSES =
  'h-control w-space-64 rounded-none border-y border-acier-texte bg-ecrin-elevated text-center text-data tabular-nums text-archive disabled:opacity-disabled';

const DIGITS_ONLY = /\D/g;

/**
 * Quantité réglable en un clic ou au clavier : − et + de part et d'autre d'un champ saisissable.
 * Les flèches ↑ ↓ ajoutent ou retirent un exemplaire ; une saisie hors bornes est ramenée à la
 * borne à la sortie du champ. − est désactivé au minimum, + au maximum.
 */
export function QuantityStepper({
  id,
  value,
  onChange,
  min = CARD_ENTRY_QUANTITY.min,
  max = CARD_ENTRY_QUANTITY.max,
  disabled = false,
  required = false,
}: QuantityStepperProps) {
  /** Texte en cours de saisie, `null` hors saisie (le champ affiche alors `value`). */
  const [draft, setDraft] = useState<string | null>(null);

  function clamp(quantity: number): number {
    return Math.min(max, Math.max(min, quantity));
  }

  function commit(quantity: number) {
    setDraft(null);
    onChange(clamp(quantity));
  }

  function step(delta: number) {
    const typed = draft === null ? Number.NaN : Number(draft);
    commit((Number.isInteger(typed) && draft !== '' ? typed : value) + delta);
  }

  function handleChange(text: string) {
    const digits = text.replace(DIGITS_ONLY, '');
    setDraft(digits);
    const typed = Number(digits);
    if (digits !== '' && typed >= min && typed <= max) {
      onChange(typed);
    }
  }

  function handleBlur() {
    if (draft !== null) {
      commit(draft === '' ? min : Number(draft));
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      step(event.key === 'ArrowUp' ? 1 : -1);
    }
  }

  return (
    <div className={ROOT_CLASSES}>
      <button
        type="button"
        aria-label="Diminuer la quantité"
        disabled={disabled || value <= min}
        className={BUTTON_CLASSES}
        onClick={() => step(-1)}
      >
        <span aria-hidden="true">
          <Text variant="data">−</Text>
        </span>
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        role="spinbutton"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        required={required}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(event) => handleChange(event.currentTarget.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={INPUT_CLASSES}
      />
      <button
        type="button"
        aria-label="Augmenter la quantité"
        disabled={disabled || value >= max}
        className={BUTTON_CLASSES}
        onClick={() => step(1)}
      >
        <span aria-hidden="true">
          <Text variant="data">+</Text>
        </span>
      </button>
    </div>
  );
}
