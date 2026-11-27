import { createRef, useState } from 'react';
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

  it('pilote une liste de suggestions avec les attributs du motif combobox', () => {
    const onKeyDown = vi.fn();
    const inputRef = createRef<HTMLInputElement>();
    render(
      <SearchBar
        value="dra"
        onChange={() => {}}
        label="Chercher une carte"
        placeholder="Dracaufeu"
        inputRef={inputRef}
        onKeyDown={onKeyDown}
        maxLength={100}
        describedBy="aide"
        combobox={{ listboxId: 'suggestions', expanded: true, activeDescendantId: 'option-1' }}
      />,
    );

    const input = screen.getByRole<HTMLInputElement>('combobox', { name: 'Chercher une carte' });
    expect(input.placeholder).toBe('Dracaufeu');
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(input.getAttribute('aria-controls')).toBe('suggestions');
    expect(input.getAttribute('aria-activedescendant')).toBe('option-1');
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-describedby')).toBe('aide');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(input.maxLength).toBe(100);
    expect(inputRef.current).toBe(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('rend le focus au champ après l’effacement, avec une référence fonction', () => {
    const received: Array<HTMLInputElement | null> = [];
    render(
      <SearchBar
        value="dra"
        onChange={() => {}}
        inputRef={(node) => {
          received.push(node);
        }}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }));

    expect(document.activeElement).toBe(received[0]);
  });

  it('se désactive sans croix d’effacement', () => {
    render(<SearchBar value="dra" onChange={() => {}} disabled />);

    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Rechercher' }).disabled).toBe(
      true,
    );
    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull();
  });
});
