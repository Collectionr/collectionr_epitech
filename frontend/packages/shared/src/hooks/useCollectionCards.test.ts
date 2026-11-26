import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  cardEntryView,
  cardsPage,
  createCollectionHarness,
  TEST_COLLECTION,
} from './mocks/createCollectionHarness';
import { nextCardsPage, useCollectionCards } from './useCollectionCards';

const CARDS_PATH = `/collections/${TEST_COLLECTION.id}/cards`;
const FIRST = cardEntryView({ id: '617559c7-285c-4ce4-9f75-3dd33ad96222' });
const SECOND = cardEntryView({ id: '5a53b7c7-0a90-4a11-92a6-26f7a9a2fff3' });

describe('nextCardsPage', () => {
  it('donne la page suivante tant que des lignes restent à charger', () => {
    expect(nextCardsPage({ items: [], total: 51, page: 1, pageSize: 50 })).toBe(2);
    expect(nextCardsPage({ items: [], total: 100, page: 2, pageSize: 50 })).toBeUndefined();
    expect(nextCardsPage({ items: [], total: 0, page: 1, pageSize: 50 })).toBeUndefined();
  });
});

describe('useCollectionCards', () => {
  it('charge les cartes page par page, jusqu’à la dernière', async () => {
    const { client, wrapper } = createCollectionHarness({
      [`${CARDS_PATH}?page=1&pageSize=50`]: async () => ({
        ...cardsPage([FIRST], 1, 51),
      }),
      [`${CARDS_PATH}?page=2&pageSize=50`]: async () => cardsPage([SECOND], 2, 51),
    });
    const { result } = renderHook(() => useCollectionCards(TEST_COLLECTION.id), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.items).toEqual([FIRST]);
    expect(result.current.hasNextPage).toBe(true);

    await act(() => result.current.fetchNextPage());

    await waitFor(() =>
      expect(result.current.data?.pages.map((page) => page.items)).toEqual([[FIRST], [SECOND]]),
    );
    expect(result.current.hasNextPage).toBe(false);
    expect(client.request).toHaveBeenCalledTimes(2);
  });

  it('ne charge rien sans collection', () => {
    const { client, wrapper } = createCollectionHarness();
    const { result } = renderHook(() => useCollectionCards(''), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(client.request).not.toHaveBeenCalled();
  });
});
