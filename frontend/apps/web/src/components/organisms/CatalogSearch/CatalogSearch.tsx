import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent, Ref } from 'react';

import { CATALOG_SEARCH } from '@shared/constants';
import type { CatalogSearchState } from '@shared/hooks';
import { spacing } from '@shared/tokens';
import type { CatalogCard } from '@shared/types';

import { Button, Text } from '../../atoms';
import { assignRef } from '../../assignRef';
import { CardThumbnail, EmptyState, SearchBar } from '../../molecules';

/** Propriétés de CatalogSearch. */
export interface CatalogSearchProps {
  /** Texte saisi, contrôlé par la page. */
  value: string;
  /** Reçoit le texte saisi, et une chaîne vide à l'effacement. */
  onValueChange: (value: string) => void;
  /** État de la recherche (`useSearchCatalog`), fourni par la page. */
  search: CatalogSearchState;
  /** Reçoit la carte choisie. */
  onSelect: (card: CatalogCard) => void;
  /** Référence vers le champ (retour du focus après un ajout). */
  inputRef?: Ref<HTMLInputElement>;
  /** Place le focus dans le champ à l'affichage. */
  autoFocus?: boolean;
  /** Désactive la recherche (envoi en cours) : champ inactif, suggestions fermées. */
  disabled?: boolean;
}

/** Suggestions visibles avant de faire défiler la liste. */
const VISIBLE_SUGGESTIONS = 8;
/** Hauteur d'une suggestion (`h-space-48`) : vignette et deux lignes de texte. */
const SUGGESTION_HEIGHT = spacing['space-48'];

const HELP_TEXT = `Nom de la carte (${CATALOG_SEARCH.minLength} caractères minimum)`;
/** Une ligne caption insécable : la place de l'aide reste réservée une fois la recherche lancée. */
const EMPTY_HELP = '\u00A0';

/** Ouverte instantanément, sans animation : la vitesse perçue prime. */
const PANEL_CLASSES =
  'absolute left-0 right-0 top-full z-10 mt-space-4 flex flex-col border border-lisere bg-ecrin';

const OPTION_CLASSES =
  'flex h-space-48 cursor-pointer items-center gap-space-12 border px-space-12 transition-colors duration-instant';
/** Option active : fond ecrin-elevated et liséré ; bordure transparente au repos, sans saut. */
const OPTION_ACTIVE_CLASSES = `${OPTION_CLASSES} border-lisere bg-ecrin-elevated`;
const OPTION_IDLE_CLASSES = `${OPTION_CLASSES} border-transparent`;

/** Nom affiché : celui qui contient le texte saisi, le français de préférence. */
function displayedName({ card }: CatalogCard, term: string): string {
  const lowerTerm = term.toLocaleLowerCase('fr-FR');
  const names = [card.nameFr, card.nameEn].filter((name): name is string => name !== null);
  return (
    names.find((name) => name.toLocaleLowerCase('fr-FR').includes(lowerTerm)) ??
    names[0] ??
    card.nameEn
  );
}

/** Nom avec la partie tapée en gras. */
function HighlightedName({ name, term }: { name: string; term: string }) {
  const start =
    term === '' ? -1 : name.toLocaleLowerCase('fr-FR').indexOf(term.toLocaleLowerCase('fr-FR'));
  if (start < 0) {
    return <>{name}</>;
  }
  const end = start + term.length;
  return (
    <>
      {name.slice(0, start)}
      <strong className="font-sans-bold">{name.slice(start, end)}</strong>
      {name.slice(end)}
    </>
  );
}

/**
 * Recherche d'une carte dans le catalogue, en autocomplétion (motif ARIA combobox) : ↓ ↑ parcourent
 * les suggestions, Entrée choisit, Échap ferme puis vide, Tab sort sans choisir. Pendant une
 * recherche, les suggestions précédentes restent affichées avec « Recherche… ». Les données
 * viennent de la page (`useSearchCatalog`).
 */
export function CatalogSearch({
  value,
  onValueChange,
  search,
  onSelect,
  inputRef,
  autoFocus = false,
  disabled = false,
}: CatalogSearchProps) {
  const baseId = useId();
  const listboxId = `${baseId}-suggestions`;
  const helpId = `${baseId}-aide`;
  const ownInput = useRef<HTMLInputElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [closed, setClosed] = useState(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const { canSearch, results, searchedTerm, isSearching, error, retry } = search;
  const activeIndex = results.findIndex(({ card }) => card.id === activeCardId);
  const noResults = searchedTerm !== '' && results.length === 0 && !isSearching && error === null;
  const hasContent = results.length > 0 || noResults || error !== null || isSearching;
  const open = focused && !closed && !disabled && canSearch && hasContent;

  useEffect(() => {
    if (autoFocus) {
      ownInput.current?.focus();
    }
  }, [autoFocus]);

  function setInput(node: HTMLInputElement | null) {
    ownInput.current = node;
    assignRef(inputRef, node);
  }

  function changeValue(nextValue: string) {
    setClosed(false);
    setActiveCardId(null);
    onValueChange(nextValue);
  }

  function select(card: CatalogCard) {
    setClosed(true);
    setActiveCardId(null);
    onSelect(card);
  }

  function moveActive(delta: number) {
    if (results.length === 0) {
      return;
    }
    setClosed(false);
    const next = Math.min(results.length - 1, Math.max(0, activeIndex + delta));
    setActiveCardId(results[next]?.card.id ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveActive(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveActive(-1);
        break;
      case 'Enter': {
        const active = results[activeIndex];
        if (open && active !== undefined) {
          event.preventDefault();
          select(active);
        }
        break;
      }
      case 'Escape':
        event.preventDefault();
        if (open) {
          setClosed(true);
          setActiveCardId(null);
        } else {
          changeValue('');
        }
        break;
    }
  }

  /** Le focus quitte le composant (Tab, clic ailleurs) : la liste se ferme, sans choix. */
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setFocused(false);
      setActiveCardId(null);
    }
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined;

  return (
    <div
      className="relative flex flex-col gap-space-4"
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
    >
      <SearchBar
        value={value}
        onChange={changeValue}
        label="Chercher une carte"
        placeholder="Dracaufeu, Pikachu…"
        inputRef={setInput}
        onKeyDown={handleKeyDown}
        maxLength={CATALOG_SEARCH.maxLength}
        disabled={disabled}
        describedBy={canSearch ? undefined : helpId}
        combobox={{
          listboxId,
          expanded: open,
          activeDescendantId: open ? activeOptionId : undefined,
        }}
      />
      {/* Ligne réservée, comme le message d'Input : le formulaire ne remonte pas quand l'aide disparaît. */}
      <span id={helpId} aria-hidden={canSearch || undefined} className="flex">
        <Text variant="caption" color="acier-texte">
          {canSearch ? EMPTY_HELP : HELP_TEXT}
        </Text>
      </span>
      <span role="status" className="sr-only">
        {searchedTerm !== '' && !isSearching && error === null
          ? `${results.length} ${results.length > 1 ? 'cartes trouvées' : 'carte trouvée'}`
          : ''}
      </span>
      {open && (
        // Un clic dans la liste ne doit pas retirer le focus du champ.
        <div className={PANEL_CLASSES} onMouseDown={(event) => event.preventDefault()}>
          {isSearching && (
            <div className="px-space-12 py-space-4">
              <Text variant="caption" color="acier-texte">
                Recherche…
              </Text>
            </div>
          )}
          {error !== null && !isSearching && (
            <div className="flex flex-col items-start gap-space-8 p-space-12">
              <Text variant="body">La recherche n’a pas abouti.</Text>
              <Button variant="secondary" onClick={retry}>
                Réessayer
              </Button>
            </div>
          )}
          {noResults && (
            // Sans bouton propre : la croix du champ efface déjà la recherche.
            <EmptyState
              variant="no-results"
              title={`Aucune carte trouvée pour “${searchedTerm}”`}
            />
          )}
          {results.length > 0 && error === null && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Suggestions de cartes"
              className="overflow-y-auto"
              style={{ maxHeight: VISIBLE_SUGGESTIONS * SUGGESTION_HEIGHT }}
            >
              {results.map((result, index) => {
                const active = index === activeIndex;
                return (
                  <li
                    key={result.card.id}
                    id={`${listboxId}-${index}`}
                    role="option"
                    aria-selected={active}
                    className={active ? OPTION_ACTIVE_CLASSES : OPTION_IDLE_CLASSES}
                    onMouseMove={() => setActiveCardId(result.card.id)}
                    onClick={() => select(result)}
                  >
                    <span className="w-space-24 shrink-0">
                      <CardThumbnail
                        card={result.card}
                        set={result.set}
                        sizes={`${spacing['space-24']}px`}
                        compact
                      />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <Text as="span" variant="body" truncate>
                        <HighlightedName
                          name={displayedName(result, searchedTerm)}
                          term={searchedTerm}
                        />
                      </Text>
                      <span className="flex min-w-0 items-baseline gap-space-8">
                        <Text variant="caption" color="acier-texte" truncate>
                          {result.set.nameFr ?? result.set.nameEn}
                        </Text>
                        <Text variant="data">{result.card.number}</Text>
                        {result.card.rarity !== null && (
                          <Text variant="caption" color="acier-texte" truncate>
                            {result.card.rarity}
                          </Text>
                        )}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
