import { createRef } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormField } from './FormField';
import type { FormFieldControlProps } from './FormField';

function getInput(): HTMLInputElement {
  return screen.getByRole('textbox');
}

describe('FormField', () => {
  it('relie le Label à l’Input par un id généré', () => {
    render(<FormField label="Adresse e-mail" />);

    const input = screen.getByRole('textbox', { name: 'Adresse e-mail' });
    expect(input.id).not.toBe('');
    expect(document.querySelector('label')?.htmlFor).toBe(input.id);
  });

  it('génère un id distinct par champ', () => {
    render(
      <>
        <FormField label="Prénom" />
        <FormField label="Nom" />
      </>,
    );

    const firstName = screen.getByRole('textbox', { name: 'Prénom' });
    const lastName = screen.getByRole('textbox', { name: 'Nom' });
    expect(firstName).not.toBe(lastName);
    expect(firstName.id).not.toBe(lastName.id);
  });

  it('utilise l’id fourni', () => {
    render(<FormField label="Adresse e-mail" id="email" />);

    expect(getInput().id).toBe('email');
    expect(document.querySelector('label')?.htmlFor).toBe('email');
  });

  it('place le Label au-dessus du champ, à space-8', () => {
    const { container } = render(<FormField label="Adresse e-mail" />);

    expect(container.firstElementChild?.className).toBe('flex flex-col gap-space-8');
  });

  it('requis : astérisque sur le Label et attribut required sur l’Input', () => {
    render(<FormField label="Adresse e-mail" required />);

    expect(screen.getByText('*')).toBeTruthy();
    expect(getInput().required).toBe(true);
    expect(screen.getByRole('textbox', { name: 'Adresse e-mail' })).toBe(getInput());
  });

  it('non requis : ni astérisque ni attribut required', () => {
    render(<FormField label="Adresse e-mail" />);

    expect(screen.queryByText('*')).toBeNull();
    expect(getInput().required).toBe(false);
  });

  it('transmet l’erreur à Input : un seul message, relié par aria-describedby', () => {
    const { container } = render(
      <FormField label="Adresse e-mail" id="email" error="Adresse e-mail invalide." />,
    );

    expect(getInput().getAttribute('aria-invalid')).toBe('true');
    expect(getInput().getAttribute('aria-describedby')).toBe('email-error');
    expect(document.getElementById('email-error')?.textContent).toBe('Adresse e-mail invalide.');
    expect(container.querySelectorAll('[id$="-error"]')).toHaveLength(1);
    expect(screen.getAllByText('Adresse e-mail invalide.')).toHaveLength(1);
  });

  it('transmet les propriétés d’Input au champ natif', () => {
    render(
      <FormField
        label="Adresse e-mail"
        name="email"
        type="email"
        placeholder="email@exemple.com"
        autoComplete="email"
        defaultValue="sacha@exemple.com"
        disabled
      />,
    );

    const input = getInput();
    expect(input.name).toBe('email');
    expect(input.type).toBe('email');
    expect(input.placeholder).toBe('email@exemple.com');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect(input.value).toBe('sacha@exemple.com');
    expect(input.disabled).toBe(true);
  });

  it('transmet onChange et onBlur au formulaire, qui valide à la sortie du champ', () => {
    const handleChange = vi.fn();
    const handleBlur = vi.fn();
    render(<FormField label="Adresse e-mail" onChange={handleChange} onBlur={handleBlur} />);

    fireEvent.change(getInput(), { target: { value: 'sacha@' } });
    fireEvent.blur(getInput());

    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleBlur).toHaveBeenCalledTimes(1);
  });

  it('conserve la valeur saisie quand l’erreur apparaît', () => {
    const { rerender } = render(<FormField label="Adresse e-mail" id="email" />);
    fireEvent.change(getInput(), { target: { value: 'sacha@' } });

    rerender(<FormField label="Adresse e-mail" id="email" error="Adresse e-mail invalide." />);

    expect(getInput().value).toBe('sacha@');
  });

  it('transmet la ref à l’input natif', () => {
    const ref = createRef<HTMLInputElement>();
    render(<FormField label="Adresse e-mail" ref={ref} />);

    expect(ref.current).toBe(getInput());
  });

  it('avec renderControl : rend le contrôle fourni à la place d’Input, avec id, required et error', () => {
    const renderControl = vi.fn((control: FormFieldControlProps) => (
      <input
        id={control.id}
        required={control.required}
        aria-invalid={control.error === undefined ? undefined : true}
        data-testid="controle"
      />
    ));
    render(
      <FormField
        label="Mot de passe"
        id="motdepasse"
        required
        error="Mot de passe trop court."
        renderControl={renderControl}
      />,
    );

    expect(renderControl).toHaveBeenCalledWith({
      id: 'motdepasse',
      required: true,
      error: 'Mot de passe trop court.',
    });
    const control = screen.getByTestId('controle');
    expect(screen.getByRole('textbox', { name: 'Mot de passe' })).toBe(control);
    expect(document.querySelectorAll('input')).toHaveLength(1);
  });

  it('avec renderControl, required vaut false par défaut', () => {
    const renderControl = vi.fn((control: FormFieldControlProps) => <input id={control.id} />);
    render(<FormField label="Mot de passe" renderControl={renderControl} />);

    expect(renderControl.mock.calls[0]?.[0].required).toBe(false);
  });

  it('refuse à la compilation les propriétés d’Input à côté de renderControl', () => {
    render(
      // @ts-expect-error Les propriétés d'Input vont au contrôle fourni, pas à FormField.
      <FormField
        label="Mot de passe"
        name="password"
        renderControl={(control: FormFieldControlProps) => <input id={control.id} />}
      />,
    );

    expect(screen.getByRole('textbox', { name: 'Mot de passe' })).toBeTruthy();
  });

  it('refuse à la compilation le type password sans contrôle fourni', () => {
    // @ts-expect-error Le mot de passe passe par renderControl et PasswordField.
    render(<FormField label="Mot de passe" type="password" />);

    expect(document.querySelector('input')).toBeTruthy();
  });
});
