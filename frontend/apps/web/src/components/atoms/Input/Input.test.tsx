import { createRef } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Input } from './Input';

const NO_BREAK_SPACE = '\u00A0';

function getInput(): HTMLInputElement {
  return screen.getByRole('textbox');
}

describe('Input', () => {
  it('transmet id, name, autoComplete et required au champ natif, en type text par défaut', () => {
    render(<Input id="prenom" name="firstName" autoComplete="given-name" required />);

    const input = getInput();
    expect(input.id).toBe('prenom');
    expect(input.name).toBe('firstName');
    expect(input.type).toBe('text');
    expect(input.getAttribute('autocomplete')).toBe('given-name');
    expect(input.required).toBe(true);
  });

  it('accepte le type email', () => {
    render(<Input id="email" type="email" />);

    expect(getInput().type).toBe('email');
  });

  it('affiche le placeholder fourni', () => {
    render(<Input id="email" placeholder="email@exemple.com" />);

    expect(getInput().placeholder).toBe('email@exemple.com');
  });

  it('sans erreur : ni aria-invalid ni aria-describedby, bordure acier-texte renforcée au survol', () => {
    render(<Input id="prenom" />);

    const input = getInput();
    expect(input.hasAttribute('aria-invalid')).toBe(false);
    expect(input.hasAttribute('aria-describedby')).toBe(false);
    expect(input.className).toContain('border-acier-texte');
    expect(input.className).toContain('group-hover:border-lisere-active');
  });

  it('réserve la place du message, masquée aux lecteurs d’écran, quand il n’y a pas d’erreur', () => {
    const { container } = render(<Input id="prenom" />);

    const message = container.querySelector('#prenom-error');
    expect(message?.getAttribute('aria-hidden')).toBe('true');
    expect(message?.className).toContain('opacity-0');
    expect(message?.textContent).toBe(NO_BREAK_SPACE);
  });

  it('en erreur : aria-invalid, message relié par aria-describedby, bordure Alerte sans survol', () => {
    render(<Input id="email" error="Adresse e-mail invalide." />);

    const input = getInput();
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('email-error');
    expect(input.className).toContain('border-alerte');
    expect(input.className).not.toContain('border-acier-texte');
    expect(input.className).not.toContain('group-hover:');

    const message = document.getElementById('email-error');
    expect(message?.textContent).toBe('Adresse e-mail invalide.');
    expect(message?.hasAttribute('aria-hidden')).toBe(false);
    expect(message?.className).toContain('opacity-100');
  });

  it('traite une erreur vide comme une absence d’erreur', () => {
    render(<Input id="prenom" error="" />);

    expect(getInput().hasAttribute('aria-invalid')).toBe(false);
  });

  it('conserve la valeur saisie quand une erreur apparaît', () => {
    const { rerender } = render(<Input id="email" type="email" />);
    fireEvent.change(getInput(), { target: { value: 'sacha@' } });

    rerender(<Input id="email" type="email" error="Adresse e-mail invalide." />);

    expect(getInput().value).toBe('sacha@');
  });

  it('désactivé : attribut natif, opacité disabled, aucun retour au survol', () => {
    const { container } = render(<Input id="prenom" disabled />);

    const input = getInput();
    expect(input.disabled).toBe(true);
    expect(input.className).not.toContain('group-hover:');
    expect(container.querySelector('.group')?.className).toContain('opacity-disabled');
  });

  it('transmet onChange et onBlur', () => {
    const handleChange = vi.fn();
    const handleBlur = vi.fn();
    render(<Input id="prenom" onChange={handleChange} onBlur={handleBlur} />);

    fireEvent.change(getInput(), { target: { value: 'Sacha' } });
    fireEvent.blur(getInput());

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('transmet la ref à l’input natif', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input id="prenom" ref={ref} />);

    expect(ref.current).toBe(getInput());
  });

  it('place l’élément intégré à droite et retire sa largeur à la zone de texte', () => {
    render(<Input id="motdepasse" trailing={<button type="button">Afficher</button>} />);

    expect(screen.getByRole('button', { name: 'Afficher' })).toBeTruthy();
    expect(getInput().className).toContain('pr-space-48');
  });

  it('sans élément intégré, garde le padding horizontal symétrique', () => {
    render(<Input id="prenom" />);

    expect(getInput().className).not.toContain('pr-space-48');
  });
});
