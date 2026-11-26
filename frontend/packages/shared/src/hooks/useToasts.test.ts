import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { toast, toastStore } from '../stores/toastStore';
import { useToasts } from './useToasts';

afterEach(() => {
  toastStore.getState().clear();
});

describe('useToasts', () => {
  it('suit les notifications affichées et fermées', () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current).toEqual([]);

    let id = 0;
    act(() => {
      id = toast.success('Carte ajoutée');
    });
    expect(result.current.map(({ message }) => message)).toEqual(['Carte ajoutée']);

    act(() => toast.dismiss(id));
    expect(result.current).toEqual([]);
  });
});
