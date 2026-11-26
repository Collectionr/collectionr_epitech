import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MOCK_CATALOGUE } from '@/mocks/data/catalogue';
import type { CatalogSearchState } from '@shared/hooks';
import { spacing } from '@shared/tokens';
import type { CatalogCard } from '@shared/types';

import { CatalogSearch } from './CatalogSearch';

const DRACAUFEU_CARDS = MOCK_CATALOGUE.filter(({ card }) => card.nameFr?.startsWith('Dracaufeu'));

function searchState(overrides: Partial<CatalogSearchState> = {}): CatalogSearchState {
  return {
    canSearch: true,
    results: [],
    searchedTerm: '',
    isSearching: false,
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

const FOUND = searchState({ results: DRACAUFEU_CARDS, searchedTerm: 'drac' });

function renderSearch(search: CatalogSearchState, value = 'drac', autoFocus = false) {
  const onValueChange = vi.fn();
  const onSelect = vi.fn<(card: CatalogCard) => void>();
  render(
    <>
      <CatalogSearch
        value={value}
        onValueChange={onValueChange}
        search={search}
        onSelect={onSelect}
        autoFocus={autoFocus}
      />
      <button type="button">Après la recherche</button>
    </>,
  );
  const input = screen.getByRole('combobox', { name: 'Chercher une carte' });
  return { input, onValueChange, onSelect };
}

function openSuggestions(input: HTMLElement) {
  fireEvent.focus(input);
  return screen.getByRole('listbox', { name: 'Suggestions de cartes' });
}

describe('CatalogSearch', () => {
  it('guide la saisie sous 2 caractères, aide reliée au champ', () => {
    const { input } = renderSearch(searchState({ canSearch: false }), 'd');

    fireEvent.focus(input);

    const help = screen.getByText('Nom de la carte (2 caractères minimum)');
    expect(input.getAttribute('aria-describedby')).toBe(help.parentElement?.id);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('propose les suggestions au focus : vignette, nom en gras, set, numéro et rareté', () => {
    const { input } = renderSearch(FOUND);

    const listbox = openSuggestions(input);

    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe(listbox.id);
    const [first] = within(listbox).getAllByRole('option');
    expect(first?.querySelector('strong')?.textContent).toBe('Drac');
    expect(first?.textContent).toContain('Dracaufeu');
    expect(first?.textContent).toContain('Set de Base');
    expect(first?.textContent).toContain('4');
    expect(first?.textContent).toContain('Rare');
    expect(within(listbox).getAllByRole('img').length).toBeGreaterThan(0);
  });

  it('montre le nom anglais quand c’est lui qui contient le texte saisi', () => {
    const { input } = renderSearch(
      searchState({ results: DRACAUFEU_CARDS, searchedTerm: 'chari' }),
    );

    const listbox = openSuggestions(input);

    expect(within(listbox).getAllByRole('option')[0]?.querySelector('strong')?.textContent).toBe(
      'Chari',
    );
  });

  it('montre 8 suggestions avant de faire défiler la liste', () => {
    const { input } = renderSearch(FOUND);

    const listbox = openSuggestions(input);

    expect(listbox.style.maxHeight).toBe(`${8 * spacing['space-48']}px`);
    expect(listbox.className).toContain('overflow-y-auto');
  });

  it('parcourt les suggestions au clavier et choisit avec Entrée', () => {
    const { input, onSelect } = renderSearch(FOUND);
    const listbox = openSuggestions(input);
    const options = within(listbox).getAllByRole('option');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[1]?.id);
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    expect(options[1]?.className).toContain('bg-ecrin-elevated');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).toHaveBeenCalledWith(DRACAUFEU_CARDS[0]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ne choisit rien avec Entrée sans suggestion active', () => {
    const { input, onSelect } = renderSearch(FOUND);
    openSuggestions(input);

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('choisit une suggestion au clic', () => {
    const { input, onSelect } = renderSearch(FOUND);
    const listbox = openSuggestions(input);

    fireEvent.click(within(listbox).getAllByRole('option')[2] as HTMLElement);

    expect(onSelect).toHaveBeenCalledWith(DRACAUFEU_CARDS[2]);
  });

  it('ferme la liste avec Échap, puis vide le champ', () => {
    const { input, onValueChange } = renderSearch(FOUND);
    openSuggestions(input);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onValueChange).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('se ferme sans choisir quand le focus sort (Tab)', () => {
    const { input, onSelect } = renderSearch(FOUND);
    openSuggestions(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    fireEvent.blur(input, {
      relatedTarget: screen.getByRole('button', { name: 'Après la recherche' }),
    });

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('rouvre la liste quand la saisie reprend', () => {
    const { input, onValueChange } = renderSearch(FOUND);
    openSuggestions(input);
    fireEvent.keyDown(input, { key: 'Escape' });

    fireEvent.change(input, { target: { value: 'draca' } });

    expect(onValueChange).toHaveBeenCalledWith('draca');
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('garde les suggestions précédentes pendant la recherche, avec « Recherche… »', () => {
    const { input } = renderSearch(searchState({ ...FOUND, isSearching: true }));

    openSuggestions(input);

    expect(screen.getByText('Recherche…')).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(DRACAUFEU_CARDS.length);
  });

  it('signale une recherche sans résultat et propose de l’effacer', () => {
    const { input, onValueChange } = renderSearch(searchState({ searchedTerm: 'zzz' }), 'zzz');
    fireEvent.focus(input);

    const emptyState = screen.getByText('Aucune carte trouvée pour “zzz”').closest('div');
    expect(emptyState).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('0 carte trouvée');
    fireEvent.click(
      within(emptyState as HTMLElement).getByRole('button', { name: 'Effacer la recherche' }),
    );

    expect(onValueChange).toHaveBeenCalledWith('');
  });

  it('signale l’échec de la recherche et propose de réessayer', () => {
    const retry = vi.fn();
    const { input } = renderSearch(searchState({ error: new Error('Réseau'), retry }));
    fireEvent.focus(input);

    expect(screen.getByText('La recherche n’a pas abouti.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('annonce le nombre de cartes trouvées', () => {
    renderSearch(FOUND);

    expect(screen.getByRole('status').textContent).toBe(
      `${DRACAUFEU_CARDS.length} cartes trouvées`,
    );
  });

  it('place le focus dans le champ à l’arrivée quand on le lui demande', () => {
    const { input } = renderSearch(FOUND, 'drac', true);

    expect(document.activeElement).toBe(input);
  });

  it('active une suggestion au survol, et garde le focus dans le champ au clic', () => {
    const { input } = renderSearch(FOUND);
    const listbox = openSuggestions(input);
    const third = within(listbox).getAllByRole('option')[2] as HTMLElement;

    fireEvent.mouseMove(third);
    const pressed = fireEvent.mouseDown(third);

    expect(input.getAttribute('aria-activedescendant')).toBe(third.id);
    expect(pressed).toBe(false);
  });

  it('ignore les flèches sans suggestion', () => {
    const { input } = renderSearch(searchState({ isSearching: true }));
    fireEvent.focus(input);

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(input.hasAttribute('aria-activedescendant')).toBe(false);
  });

  it('affiche le nom sans gras quand il ne contient pas le texte cherché', () => {
    const { input } = renderSearch(searchState({ results: DRACAUFEU_CARDS, searchedTerm: 'xyz' }));

    const listbox = openSuggestions(input);

    expect(listbox.querySelector('strong')).toBeNull();
    expect(within(listbox).getAllByRole('option')[0]?.textContent).toContain('Dracaufeu');
  });
});
