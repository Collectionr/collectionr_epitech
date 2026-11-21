import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent, Ref } from 'react';

import { Icon, Input } from '@/components/atoms';
import type { InputProps } from '@/components/atoms';

/** Propriétés de PasswordField : celles d'Input, sauf le type et l'élément intégré, qu'il pilote. */
export type PasswordFieldProps = Omit<InputProps, 'type' | 'trailing'>;

/** Sélection de l'input natif, mémorisée le temps de changer son type. */
interface TextSelection {
  start: number | null;
  end: number | null;
  direction: 'forward' | 'backward' | 'none' | null;
}

const SHOW_LABEL = 'Afficher le mot de passe';
const HIDE_LABEL = 'Masquer le mot de passe';

/**
 * Bouton carré occupant toute la hauteur du champ, sur la largeur réservée par Input (`space-48`).
 * Icône acier-texte, renforcée en Archive au survol ; le focus reste la règle globale.
 */
const TOGGLE_CLASSES =
  'flex flex-1 items-center justify-center rounded-none text-acier-texte transition-colors duration-instant enabled:hover:text-archive';

/**
 * Attache `node` à la ref reçue et renvoie de quoi l'en détacher, selon la règle de React 19 :
 * le nettoyage renvoyé par une ref callback s'il existe, sinon `ref(null)` pour une callback
 * classique ; `current` remis à null pour une ref objet.
 */
function attachRef<T>(ref: Ref<T> | undefined, node: T): () => void {
  if (typeof ref === 'function') {
    const cleanup = ref(node);
    return typeof cleanup === 'function'
      ? cleanup
      : () => {
          ref(null);
        };
  }
  if (ref) {
    ref.current = node;
    return () => {
      ref.current = null;
    };
  }
  return () => {};
}

/**
 * Champ mot de passe avec bascule afficher/masquer, intégrée au champ et focusable séparément.
 * Le libellé du bouton change avec l'état (pas d'`aria-pressed`, qui l'annoncerait deux fois).
 * Basculer ne perd ni le curseur ni la sélection : à la souris, le champ garde le focus
 * (et la validation au blur ne se déclenche pas) ; dans tous les cas, la sélection est restaurée
 * après le changement de type. À placer dans FormField avec `renderControl`.
 */
export function PasswordField({ ref, id, disabled = false, ...inputProps }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectionRef = useRef<TextSelection | null>(null);

  // Ref callback avec nettoyage (React 19) : React appelle ce nettoyage au démontage ou au
  // remplacement de la ref, et n'appelle plus jamais setInputRef(null).
  const setInputRef = useCallback(
    (node: HTMLInputElement) => {
      inputRef.current = node;
      const detachRef = attachRef(ref, node);
      return () => {
        inputRef.current = null;
        detachRef();
      };
    },
    [ref],
  );

  useLayoutEffect(() => {
    const input = inputRef.current;
    const selection = selectionRef.current;
    if (!input || !selection || selection.start === null || selection.end === null) {
      return;
    }
    input.setSelectionRange(selection.start, selection.end, selection.direction ?? undefined);
    selectionRef.current = null;
  }, [isVisible]);

  function handleToggleMouseDown(event: MouseEvent<HTMLButtonElement>) {
    // Garde le focus (et la sélection) dans le champ : pas de blur, donc pas de validation intempestive.
    event.preventDefault();
  }

  function handleToggleClick() {
    const input = inputRef.current;
    if (input) {
      selectionRef.current = {
        start: input.selectionStart,
        end: input.selectionEnd,
        direction: input.selectionDirection,
      };
    }
    setIsVisible((wasVisible) => !wasVisible);
  }

  return (
    <Input
      {...inputProps}
      ref={setInputRef}
      id={id}
      type={isVisible ? 'text' : 'password'}
      disabled={disabled}
      trailing={
        <button
          type="button"
          aria-label={isVisible ? HIDE_LABEL : SHOW_LABEL}
          aria-controls={id}
          disabled={disabled}
          onMouseDown={handleToggleMouseDown}
          onClick={handleToggleClick}
          className={TOGGLE_CLASSES}
        >
          <Icon name={isVisible ? 'eye-off' : 'eye'} />
        </button>
      }
    />
  );
}
