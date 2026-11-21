import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Icon } from '@/components/atoms';

import { FormField } from '../FormField';

import { PasswordField } from './PasswordField';

const SHOW_LABEL = 'Afficher le mot de passe';
const HIDE_LABEL = 'Masquer le mot de passe';

function getInput(): HTMLInputElement {
  const input = document.querySelector('input');
  if (!input) {
    throw new Error('Champ non rendu');
  }
  return input;
}

function getToggle(name: string): HTMLButtonElement {
  return screen.getByRole('button', { name });
}

/**
 * jsdom conserve la sélection quand le type d'un input change ; un navigateur peut la perdre.
 * Simule ce cas pour que les tests prouvent la restauration faite par PasswordField.
 */
function resetSelectionOnTypeChange(input: HTMLInputElement) {
  const typeProperty = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'type');
  Object.defineProperty(input, 'type', {
    configurable: true,
    get(this: HTMLInputElement) {
      return typeProperty?.get?.call(this);
    },
    set(this: HTMLInputElement, value: string) {
      typeProperty?.set?.call(this, value);
      this.setSelectionRange(0, 0);
    },
  });
}

describe('PasswordField', () => {
  it('masque le mot de passe par défaut, avec un bouton « Afficher » relié au champ', () => {
    render(<PasswordField id="motdepasse" />);

    expect(getInput().type).toBe('password');
    const toggle = getToggle(SHOW_LABEL);
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-controls')).toBe('motdepasse');
    expect(toggle.hasAttribute('aria-pressed')).toBe(false);
  });

  it('affiche puis masque le mot de passe, avec un libellé et une icône qui suivent l’état', () => {
    render(<PasswordField id="motdepasse" />);

    expect(getToggle(SHOW_LABEL).innerHTML).toBe(renderToStaticMarkup(<Icon name="eye" />));

    fireEvent.click(getToggle(SHOW_LABEL));
    expect(getInput().type).toBe('text');
    expect(getToggle(HIDE_LABEL).innerHTML).toBe(renderToStaticMarkup(<Icon name="eye-off" />));
    expect(getToggle(HIDE_LABEL).hasAttribute('aria-pressed')).toBe(false);

    fireEvent.click(getToggle(HIDE_LABEL));
    expect(getInput().type).toBe('password');
    expect(screen.queryByRole('button', { name: HIDE_LABEL })).toBeNull();
  });

  it('empêche le bouton de prendre le focus à la souris : le champ ne perd pas le focus', () => {
    render(<PasswordField id="motdepasse" />);

    const isNotPrevented = fireEvent.mouseDown(getToggle(SHOW_LABEL));

    expect(isNotPrevented).toBe(false);
  });

  it('garde le focus et la sélection dans le champ après une bascule à la souris', () => {
    render(<PasswordField id="motdepasse" defaultValue="Pikachu2026" />);
    const input = getInput();
    resetSelectionOnTypeChange(input);
    input.focus();
    input.setSelectionRange(2, 7, 'backward');

    fireEvent.mouseDown(getToggle(SHOW_LABEL));
    fireEvent.click(getToggle(SHOW_LABEL));

    expect(document.activeElement).toBe(input);
    expect(input.type).toBe('text');
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([
      2,
      7,
      'backward',
    ]);
  });

  it('restaure la sélection après une bascule au clavier, le focus étant sur le bouton', () => {
    render(<PasswordField id="motdepasse" defaultValue="Pikachu2026" />);
    const input = getInput();
    resetSelectionOnTypeChange(input);
    input.setSelectionRange(4, 4);
    getToggle(SHOW_LABEL).focus();

    fireEvent.click(getToggle(SHOW_LABEL));
    fireEvent.click(getToggle(HIDE_LABEL));

    expect(document.activeElement).toBe(getToggle(SHOW_LABEL));
    expect(input.type).toBe('password');
    expect([input.selectionStart, input.selectionEnd]).toEqual([4, 4]);
  });

  it('conserve la valeur saisie à la bascule', () => {
    render(<PasswordField id="motdepasse" />);
    fireEvent.change(getInput(), { target: { value: 'Pikachu2026' } });

    fireEvent.click(getToggle(SHOW_LABEL));

    expect(getInput().value).toBe('Pikachu2026');
  });

  it('transmet les propriétés d’Input au champ natif', () => {
    const handleChange = vi.fn();
    const handleBlur = vi.fn();
    render(
      <PasswordField
        id="motdepasse"
        name="password"
        autoComplete="new-password"
        placeholder="8 caractères minimum"
        required
        onChange={handleChange}
        onBlur={handleBlur}
      />,
    );

    const input = getInput();
    expect(input.id).toBe('motdepasse');
    expect(input.name).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('new-password');
    expect(input.placeholder).toBe('8 caractères minimum');
    expect(input.required).toBe(true);

    fireEvent.change(input, { target: { value: 'Pikachu2026' } });
    fireEvent.blur(input);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('affiche l’erreur par Input, reliée au champ', () => {
    render(
      <PasswordField
        id="motdepasse"
        error="Au moins 8 caractères, dont une lettre et un chiffre."
      />,
    );

    expect(getInput().getAttribute('aria-invalid')).toBe('true');
    expect(getInput().getAttribute('aria-describedby')).toBe('motdepasse-error');
    expect(document.getElementById('motdepasse-error')?.textContent).toBe(
      'Au moins 8 caractères, dont une lettre et un chiffre.',
    );
  });

  it('désactivé : champ et bouton désactivés, sans retour au survol', () => {
    render(<PasswordField id="motdepasse" disabled />);

    expect(getInput().disabled).toBe(true);
    expect(getToggle(SHOW_LABEL).disabled).toBe(true);
    expect(getToggle(SHOW_LABEL).className).toContain('enabled:hover:text-archive');
  });

  it('transmet la ref à l’input natif, objet ou fonction', () => {
    const objectRef = createRef<HTMLInputElement>();
    const { unmount } = render(<PasswordField id="motdepasse" ref={objectRef} />);
    expect(objectRef.current).toBe(getInput());
    unmount();

    const callbackRef = vi.fn();
    render(<PasswordField id="motdepasse" ref={callbackRef} />);
    expect(callbackRef).toHaveBeenCalledWith(getInput());
  });

  it('se compose avec FormField : intitulé, requis et erreur unique', () => {
    const { container } = render(
      <FormField
        label="Mot de passe"
        id="motdepasse"
        required
        error="Au moins 8 caractères, dont une lettre et un chiffre."
        renderControl={(control) => (
          <PasswordField {...control} name="password" autoComplete="new-password" />
        )}
      />,
    );

    const label = getInput().labels?.[0];
    expect(label?.htmlFor).toBe('motdepasse');
    expect(label?.textContent).toContain('Mot de passe');
    expect(getInput().required).toBe(true);
    expect(getInput().getAttribute('aria-describedby')).toBe('motdepasse-error');
    expect(container.querySelectorAll('[id$="-error"]')).toHaveLength(1);
    expect(getToggle(SHOW_LABEL)).toBeTruthy();
  });
});
