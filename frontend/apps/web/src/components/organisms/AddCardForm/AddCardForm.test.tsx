import { useState } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddCardForm } from './AddCardForm';
import type { AddCardFormProps, AddCardFormValues } from './AddCardForm';

const COLLECTIONS = [
  { id: 'c1', name: 'Classeur Base' },
  { id: 'c2', name: 'Doubles à échanger' },
];

const INITIAL: AddCardFormValues = {
  collectionId: 'c1',
  condition: '',
  language: 'fr',
  quantity: 1,
};

/** Formulaire contrôlé, comme dans la page. */
function Controlled(props: Partial<AddCardFormProps> & { initial?: AddCardFormValues }) {
  const [values, setValues] = useState(props.initial ?? INITIAL);
  return (
    <AddCardForm
      collections={COLLECTIONS}
      values={values}
      onChange={setValues}
      cardSelected
      onSubmit={() => {}}
      onCancel={() => {}}
      {...props}
    />
  );
}

function field(name: string) {
  return screen.getByRole('combobox', { name: new RegExp(`^${name}`) });
}

function submitButton() {
  return screen.getByRole('button', { name: /Enregistrer/ });
}

describe('AddCardForm', () => {
  it('propose la collection, l’état, la langue et la quantité, avec les valeurs du back', () => {
    render(<Controlled />);

    expect((field('Collection') as HTMLSelectElement).value).toBe('c1');
    expect((field('État') as HTMLSelectElement).value).toBe('');
    expect((field('Langue') as HTMLSelectElement).value).toBe('fr');
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
    const conditions = Array.from((field('État') as HTMLSelectElement).options).map(
      (option) => option.textContent,
    );
    expect(conditions).toEqual([
      'Choisir un état',
      'Near Mint (NM)',
      'Lightly Played (LP)',
      'Moderately Played (MP)',
      'Heavily Played (HP)',
      'Damaged (DMG)',
    ]);
    const languages = Array.from((field('Langue') as HTMLSelectElement).options).map(
      (option) => option.textContent,
    );
    expect(languages).toEqual(['Français', 'Anglais']);
  });

  it('garde « Enregistrer » désactivé tant qu’aucune carte n’est choisie', () => {
    const onSubmit = vi.fn();
    render(<Controlled cardSelected={false} onSubmit={onSubmit} />);

    expect(submitButton().hasAttribute('disabled')).toBe(true);
    fireEvent.submit(submitButton().closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('envoie les valeurs choisies', () => {
    const onSubmit = vi.fn();
    render(<Controlled onSubmit={onSubmit} />);

    fireEvent.change(field('Collection'), { target: { value: 'c2' } });
    fireEvent.change(field('État'), { target: { value: 'LP' } });
    fireEvent.change(field('Langue'), { target: { value: 'en' } });
    fireEvent.click(screen.getByRole('button', { name: 'Augmenter la quantité' }));
    fireEvent.click(submitButton());

    expect(onSubmit).toHaveBeenCalledWith({
      collectionId: 'c2',
      condition: 'LP',
      language: 'en',
      quantity: 2,
    });
  });

  it('signale un état manquant à l’envoi et y place le focus, puis efface l’erreur', () => {
    const onSubmit = vi.fn();
    render(<Controlled onSubmit={onSubmit} />);

    fireEvent.click(submitButton());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choisissez l’état de la carte.')).toBeTruthy();
    expect(document.activeElement).toBe(field('État'));
    expect(field('État').getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(field('État'), { target: { value: 'NM' } });

    expect(field('État').hasAttribute('aria-invalid')).toBe(false);
  });

  it('signale une collection manquante en premier', () => {
    render(<Controlled initial={{ ...INITIAL, collectionId: '' }} />);

    fireEvent.click(submitButton());

    expect(screen.getByText('Choisissez une collection.')).toBeTruthy();
    expect(document.activeElement).toBe(field('Collection'));
    fireEvent.change(field('Collection'), { target: { value: 'c1' } });
    expect(screen.queryByText('Choisissez une collection.')).toBeNull();
  });

  it('enregistre avec Entrée depuis le dernier champ (envoi natif du formulaire)', () => {
    const onSubmit = vi.fn();
    render(<Controlled initial={{ ...INITIAL, condition: 'NM' }} onSubmit={onSubmit} />);

    const quantity = screen.getByRole('spinbutton');
    expect(quantity.closest('form')).toBe(submitButton().closest('form'));
    expect(submitButton().getAttribute('type')).toBe('submit');
    fireEvent.submit(quantity.closest('form') as HTMLFormElement);

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('affiche « Ajout… » pendant l’envoi, sans renvoyer', () => {
    const onSubmit = vi.fn();
    render(<Controlled initial={{ ...INITIAL, condition: 'NM' }} submitting onSubmit={onSubmit} />);

    expect(submitButton().getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText('Ajout…')).toBeTruthy();
    fireEvent.submit(submitButton().closest('form') as HTMLFormElement);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('annule', () => {
    const onCancel = vi.fn();
    render(<Controlled onCancel={onCancel} />);

    fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
