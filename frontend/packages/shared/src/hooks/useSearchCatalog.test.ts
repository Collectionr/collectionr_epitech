import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CATALOG_SEARCH } from '../constants/catalog';
import { ApiError } from '../services/apiClient';
import type { AbortSignalLike } from '../services/apiClient';
import type { CatalogCard } from '../types';
import { runtimeTimers } from '../utils/runtimeTimers';
import { catalogCard, createCatalogHarness } from './mocks/createCatalogHarness';
import { useSearchCatalog } from './useSearchCatalog';

const DRACAUFEU = catalogCard('Dracaufeu');
const DRACAUFEU_VMAX = catalogCard('Dracaufeu VMAX');
const PIKACHU = catalogCard('Pikachu');

/** Laisse passer plus que la temporisation, sans aucune frappe. */
function waitBeyondDebounce() {
  return new Promise<void>((resolve) => {
    runtimeTimers().setTimeout(resolve, CATALOG_SEARCH.debounceMs + 100);
  });
}

/** Réponses tenues en attente par terme, réglées par le test ; garde le signal de chaque requête. */
function pendingResponses() {
  const pending = new Map<
    string,
    { resolve: (cards: CatalogCard[]) => void; signal: AbortSignalLike | undefined }
  >();
  const respond = (term: string, signal: AbortSignalLike | undefined) =>
    new Promise<CatalogCard[]>((resolve) => {
      pending.set(term, { resolve, signal });
    });
  return { pending, respond };
}

function renderSearch(harness: ReturnType<typeof createCatalogHarness>, text: string) {
  return renderHook(({ value }) => useSearchCatalog(value), {
    wrapper: harness.wrapper,
    initialProps: { value: text },
  });
}

describe('useSearchCatalog', () => {
  it('ne cherche rien sous 2 caractères', async () => {
    const harness = createCatalogHarness(async () => [DRACAUFEU]);
    const { result } = renderSearch(harness, 'd');

    await waitBeyondDebounce();

    expect(harness.client.request).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ canSearch: false, isSearching: false, results: [] });
  });

  it('attend 200 ms après la dernière frappe et ne cherche que le dernier terme', async () => {
    const harness = createCatalogHarness(async () => [DRACAUFEU]);
    const { result, rerender } = renderSearch(harness, '');

    rerender({ value: 'dr' });
    rerender({ value: 'dra' });
    rerender({ value: 'drac' });

    expect(result.current.isSearching).toBe(true);
    expect(harness.client.request).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.results).toEqual([DRACAUFEU]));
    expect(harness.searchedTerms()).toEqual(['drac']);
    expect(result.current).toMatchObject({ searchedTerm: 'drac', isSearching: false });
  });

  it('ignore les espaces de début et de fin', async () => {
    const harness = createCatalogHarness(async () => [PIKACHU]);
    const { result } = renderSearch(harness, '  pika ');

    await waitFor(() => expect(result.current.searchedTerm).toBe('pika'));
    expect(harness.searchedTerms()).toEqual(['pika']);
  });

  it('annule la recherche devenue obsolète', async () => {
    const { pending, respond } = pendingResponses();
    const harness = createCatalogHarness(respond);
    const { rerender } = renderSearch(harness, 'dra');
    await waitFor(() => expect(pending.has('dra')).toBe(true));

    rerender({ value: 'drac' });

    await waitFor(() => expect(pending.has('drac')).toBe(true));
    expect(pending.get('dra')?.signal?.aborted).toBe(true);
    expect(pending.get('drac')?.signal?.aborted).toBe(false);
  });

  it('garde les résultats précédents pendant la nouvelle recherche', async () => {
    const { pending, respond } = pendingResponses();
    const harness = createCatalogHarness(respond);
    const { result, rerender } = renderSearch(harness, 'dra');
    await waitFor(() => expect(pending.has('dra')).toBe(true));
    act(() => pending.get('dra')?.resolve([DRACAUFEU]));
    await waitFor(() => expect(result.current.results).toEqual([DRACAUFEU]));

    rerender({ value: 'dracaufeu v' });
    await waitFor(() => expect(pending.has('dracaufeu v')).toBe(true));

    expect(result.current).toMatchObject({
      results: [DRACAUFEU],
      searchedTerm: 'dra',
      isSearching: true,
    });
    act(() => pending.get('dracaufeu v')?.resolve([DRACAUFEU_VMAX]));
    await waitFor(() => expect(result.current.results).toEqual([DRACAUFEU_VMAX]));
    expect(result.current.searchedTerm).toBe('dracaufeu v');
  });

  it('sert une recherche déjà faite depuis le cache, sans nouvel appel', async () => {
    const harness = createCatalogHarness(async (term) =>
      term === 'pika' ? [PIKACHU] : [DRACAUFEU],
    );
    const { result, rerender } = renderSearch(harness, 'pika');
    await waitFor(() => expect(result.current.searchedTerm).toBe('pika'));
    rerender({ value: 'drac' });
    await waitFor(() => expect(result.current.searchedTerm).toBe('drac'));

    rerender({ value: 'pika' });

    await waitFor(() => expect(result.current.results).toEqual([PIKACHU]));
    expect(harness.searchedTerms()).toEqual(['pika', 'drac']);
  });

  it('ne montre plus de résultats quand le texte redescend sous 2 caractères', async () => {
    const harness = createCatalogHarness(async () => [PIKACHU]);
    const { result, rerender } = renderSearch(harness, 'pika');
    await waitFor(() => expect(result.current.results).toEqual([PIKACHU]));

    rerender({ value: 'p' });

    expect(result.current).toMatchObject({ canSearch: false, results: [], searchedTerm: '' });
  });

  it('expose l’échec de la recherche, puis la relance', async () => {
    let attempts = 0;
    const harness = createCatalogHarness(async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new ApiError({ status: 400, code: 'Bad Request', message: 'Invalid search' });
      }
      return [PIKACHU];
    });
    const { result } = renderSearch(harness, 'pika');
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.results).toEqual([PIKACHU]));
    expect(result.current.error).toBeNull();
    expect(attempts).toBe(2);
  });

  it('exige le service du catalogue à la racine', () => {
    expect(() => renderHook(() => useSearchCatalog('pika'))).toThrow(
      'CatalogServiceContext absent',
    );
  });
});
