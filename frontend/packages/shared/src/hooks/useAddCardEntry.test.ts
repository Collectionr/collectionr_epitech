import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QUERY_KEYS } from '../constants/queryKeys';
import { ApiError } from '../services/apiClient';
import type { CardEntry } from '../types';
import {
  cardEntry,
  cardEntryView,
  cardsPage,
  createCollectionHarness,
  TEST_CARD,
  TEST_COLLECTION,
  TEST_SET,
} from './mocks/createCollectionHarness';
import { OPTIMISTIC_ENTRY_ID_PREFIX, useAddCardEntry } from './useAddCardEntry';
import type { AddCardEntryVariables } from './useAddCardEntry';
import type { CollectionCardsData } from './useCollectionCards';

const CARDS_KEY = QUERY_KEYS.cards(TEST_COLLECTION.id);
const ADD_PATH = `/collections/${TEST_COLLECTION.id}/cards`;
const EXISTING = cardEntryView({ id: '0c4353cf-34e3-4167-9146-31bc970617ad' });

const VARIABLES: AddCardEntryVariables = {
  collectionId: TEST_COLLECTION.id,
  entry: { cardId: TEST_CARD.id, quantity: 2, condition: 'NM', language: 'fr' },
  preview: { card: TEST_CARD, set: TEST_SET, variant: null },
};

/** Réponse de l'API tenue en attente, réglée par le test. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

function cachedEntries(queryClient: ReturnType<typeof createCollectionHarness>['queryClient']) {
  return queryClient.getQueryData<CollectionCardsData>(CARDS_KEY)?.pages[0];
}

/** Harnais dont les réponses d'ajout sont tenues en attente, dans l'ordre des appels. */
function harnessWithPendingAdds(count: number) {
  const responses = Array.from({ length: count }, () => deferred<CardEntry>());
  let call = 0;
  const harness = createCollectionHarness({
    [ADD_PATH]: () => {
      const response = responses[call];
      call += 1;
      return response ? response.promise : Promise.reject(new Error('Ajout inattendu'));
    },
  });
  harness.queryClient.setQueryData<CollectionCardsData>(CARDS_KEY, {
    pages: [cardsPage([EXISTING])],
    pageParams: [1],
  });
  const { result } = renderHook(() => useAddCardEntry(), { wrapper: harness.wrapper });
  return { ...harness, responses, result };
}

describe('useAddCardEntry', () => {
  it('affiche la ligne tout de suite, en tête des cartes de la collection', async () => {
    const { queryClient, result } = harnessWithPendingAdds(1);

    act(() => result.current.mutate(VARIABLES));

    await waitFor(() => expect(cachedEntries(queryClient)?.items).toHaveLength(2));
    const page = cachedEntries(queryClient);
    expect(page?.total).toBe(2);
    expect(page?.items[0]?.id.startsWith(OPTIMISTIC_ENTRY_ID_PREFIX)).toBe(true);
    expect(page?.items[0]).toMatchObject({ card: TEST_CARD, quantity: 2, condition: 'NM' });
    expect(page?.items[1]).toEqual(EXISTING);
  });

  it('donne à la ligne l’identifiant renvoyé par l’API, sans perdre la carte', async () => {
    const { queryClient, responses, result } = harnessWithPendingAdds(1);
    const created = cardEntry({ id: '08360273-6e4a-48d5-abec-a54c809790e4', quantity: 2 });

    act(() => result.current.mutate(VARIABLES));
    await waitFor(() => expect(cachedEntries(queryClient)?.items).toHaveLength(2));
    await act(async () => responses[0]?.resolve(created));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(cachedEntries(queryClient)?.items[0]).toEqual({
      ...created,
      card: TEST_CARD,
      set: TEST_SET,
      variant: null,
    });
    expect(cachedEntries(queryClient)?.total).toBe(2);
  });

  it('invalide la collection et ses cartes, et rien d’autre', async () => {
    const { queryClient, responses, result } = harnessWithPendingAdds(1);
    queryClient.setQueryData(QUERY_KEYS.collections, [TEST_COLLECTION]);
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries');

    act(() => result.current.mutate(VARIABLES));
    await act(async () => responses[0]?.resolve(cardEntry()));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: QUERY_KEYS.collection(TEST_COLLECTION.id),
    });
    expect(queryClient.getQueryState(CARDS_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(QUERY_KEYS.collections)?.isInvalidated).toBe(false);
  });

  it('retire la ligne si l’API refuse, sans toucher à un autre ajout en cours', async () => {
    const { queryClient, responses, result } = harnessWithPendingAdds(2);
    const refusal = new ApiError({ status: 404, code: 'Not Found', message: 'Card not found' });

    act(() => result.current.mutate(VARIABLES));
    act(() => result.current.mutate({ ...VARIABLES, entry: { ...VARIABLES.entry, quantity: 5 } }));
    await waitFor(() => expect(cachedEntries(queryClient)?.items).toHaveLength(3));

    await act(async () => responses[0]?.reject(refusal));

    await waitFor(() => expect(cachedEntries(queryClient)?.items).toHaveLength(2));
    const page = cachedEntries(queryClient);
    expect(page?.total).toBe(2);
    expect(page?.items[0]).toMatchObject({ quantity: 5 });
    expect(page?.items[1]).toEqual(EXISTING);
    // Le hook expose le dernier ajout (toujours en cours) : l'échec du premier est dans le cache.
    const [first, second] = queryClient.getMutationCache().getAll();
    expect(first?.state).toMatchObject({ status: 'error', error: refusal });
    expect(second?.state.status).toBe('pending');
  });

  it('ajoute la carte même si aucune liste n’est en cache', async () => {
    const created = cardEntry();
    const { queryClient, wrapper } = createCollectionHarness({ [ADD_PATH]: async () => created });
    const { result } = renderHook(() => useAddCardEntry(), { wrapper });

    await act(() => result.current.mutateAsync(VARIABLES));

    await waitFor(() => expect(result.current.data).toEqual(created));
    expect(queryClient.getQueryData(CARDS_KEY)).toBeUndefined();
  });
});
