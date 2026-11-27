import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuantityStepper } from './QuantityStepper';
import type { QuantityStepperProps } from './QuantityStepper';

/** QuantityStepper contrôlé, comme dans un formulaire ; `onChange` espionné. */
function Controlled({
  initial,
  onChange,
  ...props
}: Omit<QuantityStepperProps, 'value' | 'onChange'> & {
  initial: number;
  onChange: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <QuantityStepper
      {...props}
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

function renderStepper(initial = 1, props: Partial<QuantityStepperProps> = {}) {
  const onChange = vi.fn();
  render(<Controlled initial={initial} onChange={onChange} {...props} />);
  return {
    onChange,
    input: screen.getByRole('spinbutton'),
    decrease: screen.getByRole('button', { name: 'Diminuer la quantité' }),
    increase: screen.getByRole('button', { name: 'Augmenter la quantité' }),
  };
}

describe('QuantityStepper', () => {
  it('encadre le champ des boutons − et +, avec les bornes du back', () => {
    const { input, decrease, increase } = renderStepper();

    expect(decrease.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.compareDocumentPosition(increase) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('9999');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('ajoute et retire un exemplaire par les boutons', () => {
    const { onChange, input, decrease, increase } = renderStepper(2);

    fireEvent.click(increase);
    expect((input as HTMLInputElement).value).toBe('3');
    fireEvent.click(decrease);
    fireEvent.click(decrease);

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([3, 2, 1]);
  });

  it('désactive − au minimum et + au maximum', () => {
    const atMinimum = renderStepper(1, { max: 3 });
    expect(atMinimum.decrease.hasAttribute('disabled')).toBe(true);
    expect(atMinimum.increase.hasAttribute('disabled')).toBe(false);

    fireEvent.click(atMinimum.increase);
    fireEvent.click(atMinimum.increase);

    expect(atMinimum.increase.hasAttribute('disabled')).toBe(true);
  });

  it('ajoute et retire un exemplaire avec les flèches du clavier', () => {
    const { onChange, input } = renderStepper(5);

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange.mock.calls.map(([value]) => value)).toEqual([6, 5, 4]);
  });

  it('transmet une saisie dans les bornes, en ne gardant que les chiffres', () => {
    const { onChange, input } = renderStepper();

    fireEvent.change(input, { target: { value: '1a2' } });

    expect((input as HTMLInputElement).value).toBe('12');
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it.each([
    ['au-dessus du maximum', '12000', 9999],
    ['sous le minimum', '0', 1],
    ['vide', '', 1],
  ])('ramène une saisie %s à la borne à la sortie du champ', (_case, typed, expected) => {
    const { onChange, input } = renderStepper(3);

    fireEvent.change(input, { target: { value: typed } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(expected);
    expect((input as HTMLInputElement).value).toBe(String(expected));
  });

  it('part de la saisie en cours pour une flèche', () => {
    const { onChange, input } = renderStepper(3);

    fireEvent.change(input, { target: { value: '40' } });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    expect(onChange).toHaveBeenLastCalledWith(41);
  });

  it('affiche la valeur en Data-Mono à chiffres tabulaires', () => {
    const { input } = renderStepper(9);

    expect(input.classList.contains('text-data')).toBe(true);
    expect(input.classList.contains('tabular-nums')).toBe(true);
  });

  it('marque l’appui par le liséré, sans rebond', () => {
    const { increase } = renderStepper();

    expect(increase.className).toContain('active:border-lisere-active');
    expect(increase.className).toContain('duration-instant');
    expect(increase.className).not.toMatch(/scale|bounce|animate/);
  });

  it('désactive les boutons et le champ', () => {
    const { input, decrease, increase } = renderStepper(3, { disabled: true });

    expect(input.hasAttribute('disabled')).toBe(true);
    expect(decrease.hasAttribute('disabled')).toBe(true);
    expect(increase.hasAttribute('disabled')).toBe(true);
  });

  it('à Entrée, ramène une saisie hors bornes dans les bornes puis soumet la valeur affichée', () => {
    const submitted: number[] = [];
    function FormHarness() {
      const [value, setValue] = useState(3);
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submitted.push(value);
          }}
        >
          <QuantityStepper value={value} onChange={setValue} />
        </form>
      );
    }
    render(<FormHarness />);
    const input = screen.getByRole<HTMLInputElement>('spinbutton');

    fireEvent.change(input, { target: { value: '12000' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(submitted).toEqual([9999]);
    expect(input.value).toBe('9999');
  });

  it('à Entrée sans saisie en cours, soumet directement la valeur', () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <QuantityStepper value={2} onChange={() => {}} />
      </form>,
    );

    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('remplace la saisie en cours quand le parent remet la valeur à 1 (après un ajout)', () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuantityStepper value={3} onChange={onChange} />);
    const input = screen.getByRole<HTMLInputElement>('spinbutton');
    fireEvent.change(input, { target: { value: '0' } });
    expect(input.value).toBe('0');

    rerender(<QuantityStepper value={1} onChange={onChange} />);

    expect(input.value).toBe('1');
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('n’affiche jamais une saisie déjà prise en compte après la remise à 1 par le parent', () => {
    const onChange = vi.fn();
    const { rerender } = render(<QuantityStepper value={1} onChange={onChange} />);
    const input = screen.getByRole<HTMLInputElement>('spinbutton');
    fireEvent.change(input, { target: { value: '5' } });
    expect(onChange).toHaveBeenLastCalledWith(5);
    rerender(<QuantityStepper value={5} onChange={onChange} />);
    fireEvent.blur(input);

    rerender(<QuantityStepper value={1} onChange={onChange} />);

    expect(input.value).toBe('1');
    expect(input.getAttribute('aria-valuenow')).toBe('1');
  });
});
