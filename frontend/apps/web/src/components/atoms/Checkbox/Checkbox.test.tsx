import { createRef } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { iconography } from '@shared/tokens';

import { Checkbox } from './Checkbox';

const NO_BREAK_SPACE = '\u00A0';
const CGU_LABEL = 'J’accepte les Conditions Générales d’Utilisation';

function getCheckbox(): HTMLInputElement {
  return screen.getByRole('checkbox');
}

describe('Checkbox', () => {
  it('rend une case native nommée par son libellé, avec id, name et required', () => {
    render(<Checkbox id="cgu" name="acceptedTerms" label={CGU_LABEL} required />);

    const checkbox = screen.getByRole('checkbox', { name: CGU_LABEL });
    expect(checkbox).toBe(getCheckbox());
    expect(getCheckbox().type).toBe('checkbox');
    expect(getCheckbox().id).toBe('cgu');
    expect(getCheckbox().name).toBe('acceptedTerms');
    expect(getCheckbox().required).toBe(true);
  });

  it('rend le libellé en body Archive dans un <span>, contenu valide d’un <label>', () => {
    const { container } = render(<Checkbox id="cgu" label={CGU_LABEL} />);

    const text = screen.getByText(CGU_LABEL);
    expect(text.tagName).toBe('SPAN');
    expect(text.className).toBe('text-body text-archive');
    expect(container.querySelector('label')?.contains(text)).toBe(true);
  });

  it('ne place aucun bloc (<p>, <div>) dans le <label>', () => {
    const { container } = render(<Checkbox id="cgu" label={CGU_LABEL} />);

    expect(container.querySelectorAll('label p, label div')).toHaveLength(0);
  });

  it('bascule au clic sur le libellé, pas seulement sur la case', () => {
    render(<Checkbox id="cgu" label={CGU_LABEL} />);

    fireEvent.click(screen.getByText(CGU_LABEL));
    expect(getCheckbox().checked).toBe(true);

    fireEvent.click(screen.getByText(CGU_LABEL));
    expect(getCheckbox().checked).toBe(false);
  });

  it('ne coche pas la case au clic sur un lien du libellé', () => {
    render(
      <Checkbox
        id="cgu"
        label={
          <>
            J’accepte les <a href="#cgu">Conditions Générales d’Utilisation</a>
          </>
        }
      />,
    );

    fireEvent.click(screen.getByRole('link', { name: 'Conditions Générales d’Utilisation' }));

    expect(getCheckbox().checked).toBe(false);
  });

  it('suit la valeur contrôlée et appelle onChange', () => {
    const handleChange = vi.fn();
    render(<Checkbox id="cgu" label={CGU_LABEL} checked={false} onChange={handleChange} />);

    fireEvent.click(getCheckbox());

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(getCheckbox().checked).toBe(false);
  });

  it('accepte un état initial non contrôlé', () => {
    render(<Checkbox id="cgu" label={CGU_LABEL} defaultChecked />);

    expect(getCheckbox().checked).toBe(true);
  });

  it('transmet onBlur', () => {
    const handleBlur = vi.fn();
    render(<Checkbox id="cgu" label={CGU_LABEL} onBlur={handleBlur} />);

    fireEvent.blur(getCheckbox());

    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('sans erreur : bordure acier-texte renforcée au survol si non cochée, message masqué', () => {
    const { container } = render(<Checkbox id="cgu" label={CGU_LABEL} />);

    const checkbox = getCheckbox();
    expect(checkbox.hasAttribute('aria-invalid')).toBe(false);
    expect(checkbox.hasAttribute('aria-describedby')).toBe(false);
    expect(checkbox.className).toContain('border-acier-texte');
    expect(checkbox.className).toContain('group-hover:[&:not(:checked)]:border-lisere-active');
    expect(checkbox.className).toContain('checked:bg-archive');

    const message = container.querySelector('#cgu-error');
    expect(message?.getAttribute('aria-hidden')).toBe('true');
    expect(message?.className).toContain('opacity-0');
    expect(message?.textContent).toBe(NO_BREAK_SPACE);
  });

  it('en erreur : aria-invalid, message relié par aria-describedby, bordure Alerte sans survol', () => {
    render(<Checkbox id="cgu" label={CGU_LABEL} error="Acceptez les CGU pour continuer." />);

    const checkbox = getCheckbox();
    expect(checkbox.getAttribute('aria-invalid')).toBe('true');
    expect(checkbox.getAttribute('aria-describedby')).toBe('cgu-error');
    expect(checkbox.className).toContain('border-alerte');
    expect(checkbox.className).not.toContain('border-acier-texte');
    expect(checkbox.className).not.toContain('group-hover:');

    const message = document.getElementById('cgu-error');
    expect(message?.textContent).toBe('Acceptez les CGU pour continuer.');
    expect(message?.hasAttribute('aria-hidden')).toBe(false);
    expect(message?.className).toContain('opacity-100');
  });

  it('traite une erreur vide comme une absence d’erreur', () => {
    render(<Checkbox id="cgu" label={CGU_LABEL} error="" />);

    expect(getCheckbox().hasAttribute('aria-invalid')).toBe(false);
  });

  it('désactivée : attribut natif, opacité sur toute la zone, aucun retour au survol', () => {
    const { container } = render(<Checkbox id="cgu" label={CGU_LABEL} disabled />);

    expect(getCheckbox().disabled).toBe(true);
    expect(getCheckbox().className).not.toContain('group-hover:');
    expect(container.querySelector('label')?.className).toContain('opacity-disabled');
  });

  it('trace une coche décorative au trait de l’iconographie, animée au cochage', () => {
    const { container } = render(<Checkbox id="cgu" label={CGU_LABEL} />);

    const check = container.querySelector('svg');
    expect(check?.getAttribute('aria-hidden')).toBe('true');
    expect(check?.getAttribute('stroke-width')).toBe(String(iconography.stroke));
    expect(check?.getAttribute('class')).toContain('peer-checked:[stroke-dashoffset:0]');
    expect(check?.getAttribute('class')).toContain('peer-checked:duration-snap');
    expect(check?.querySelector('path')?.getAttribute('pathLength')).toBe('1');
  });

  it('transmet la ref à l’input natif', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Checkbox id="cgu" label={CGU_LABEL} ref={ref} />);

    expect(ref.current).toBe(getCheckbox());
  });
});
