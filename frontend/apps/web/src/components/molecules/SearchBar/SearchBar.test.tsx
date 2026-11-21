import { useState } from 'react';
import type { SyntheticEvent } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('affiche un champ nommé avec son placeholder et sans bouton quand il est vide', () => {
    render(<SearchBar value="" onChange={vi.fn()} />);

    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Rechercher' });
    expect(input.placeholder).toBe('Rechercher...');
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull();
  });

  it('transmet la saisie, affiche la croix, puis efface et rend le focus au champ', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn((event: SyntheticEvent<HTMLFormElement>) => event.preventDefault());

    function ControlledSearchBar() {
      const [value, setValue] = useState('');

      return (
        <form onSubmit={onSubmit}>
          <SearchBar
            value={value}
            onChange={(nextValue) => {
              onChange(nextValue);
              setValue(nextValue);
            }}
          />
        </form>
      );
    }

    render(<ControlledSearchBar />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Rechercher' });
    fireEvent.change(input, { target: { value: 'Pika' } });
    expect(onChange).toHaveBeenNthCalledWith(1, 'Pika');
    expect(input.value).toBe('Pika');

    const clear = screen.getByRole('button', { name: 'Effacer la recherche' });
    clear.focus();
    fireEvent.click(clear);

    expect(onChange).toHaveBeenNthCalledWith(2, '');
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull();
  });
});
