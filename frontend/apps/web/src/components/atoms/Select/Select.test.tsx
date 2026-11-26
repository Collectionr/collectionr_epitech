import { createRef } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from '../../molecules';
import { Select } from './Select';
import type { SelectProps } from './Select';

const OPTIONS = [
  { value: 'NM', label: 'Near Mint (NM)' },
  { value: 'LP', label: 'Lightly Played (LP)' },
];

function renderSelect(props: Partial<SelectProps> = {}) {
  const onChange = vi.fn();
  render(
    <>
      <label htmlFor="etat">État</label>
      <Select
        id="etat"
        value=""
        onChange={onChange}
        options={OPTIONS}
        placeholder="Choisir un état"
        {...props}
      />
    </>,
  );
  return { onChange, select: screen.getByRole('combobox', { name: 'État' }) };
}

describe('Select', () => {
  it('rend un select natif avec l’option d’invite désactivée, puis les options', () => {
    const { select } = renderSelect();

    const options = screen.getAllByRole('option');
    expect(options.map((option) => option.textContent)).toEqual([
      'Choisir un état',
      'Near Mint (NM)',
      'Lightly Played (LP)',
    ]);
    expect(options[0]?.hasAttribute('disabled')).toBe(true);
    expect((select as HTMLSelectElement).value).toBe('');
  });

  it('transmet la valeur choisie', () => {
    const { onChange, select } = renderSelect();

    fireEvent.change(select, { target: { value: 'LP' } });

    expect(onChange).toHaveBeenCalledWith('LP');
  });

  it('reprend le gabarit d’Input : hauteur de contrôle, radius 0, liséré renforcé au survol', () => {
    const { select } = renderSelect({ value: 'NM' });

    for (const name of [
      'h-control',
      'rounded-none',
      'appearance-none',
      'border-acier-texte',
      'group-hover:border-lisere-active',
      'duration-instant',
    ]) {
      expect(select.classList.contains(name)).toBe(true);
    }
  });

  it('relie l’erreur au champ et garde la bordure Alerte, survol compris', () => {
    const { select } = renderSelect({ error: 'Choisissez un état' });

    expect(select.getAttribute('aria-invalid')).toBe('true');
    expect(select.getAttribute('aria-describedby')).toBe('etat-error');
    expect(document.getElementById('etat-error')?.textContent).toBe('Choisissez un état');
    expect(select.classList.contains('border-alerte')).toBe(true);
    expect(select.classList.contains('group-hover:border-lisere-active')).toBe(false);
  });

  it('réserve la place du message sans erreur, masquée aux lecteurs d’écran', () => {
    const { select } = renderSelect();

    const message = document.getElementById('etat-error');
    expect(select.hasAttribute('aria-describedby')).toBe(false);
    expect(message?.getAttribute('aria-hidden')).toBe('true');
    expect(message?.className).toContain('opacity-0');
  });

  it('se désactive avec l’attribut natif et l’opacité disabled', () => {
    const { select } = renderSelect({ disabled: true });

    expect(select.hasAttribute('disabled')).toBe(true);
    expect(select.parentElement?.classList.contains('opacity-disabled')).toBe(true);
    expect(select.classList.contains('group-hover:border-lisere-active')).toBe(false);
  });

  it('dessine son chevron sans importer Icon, masqué aux lecteurs d’écran', () => {
    const { select } = renderSelect();

    const chevron = select.parentElement?.querySelector('svg');
    expect(chevron?.getAttribute('aria-hidden')).toBe('true');
    expect(chevron?.getAttribute('stroke-width')).toBe('1.5');
  });

  it('transmet la référence au select natif', () => {
    const ref = createRef<HTMLSelectElement>();
    const { select } = renderSelect({ ref });

    expect(ref.current).toBe(select);
  });

  it('se branche dans FormField comme contrôle fourni', () => {
    render(
      <FormField
        label="Langue"
        required
        renderControl={(control) => (
          <Select
            {...control}
            value="fr"
            onChange={() => {}}
            options={[{ value: 'fr', label: 'Français' }]}
          />
        )}
      />,
    );

    const select = screen.getByRole('combobox', { name: /Langue/ });
    expect(select.hasAttribute('required')).toBe(true);
  });
});
