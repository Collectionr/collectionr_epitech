import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { LoginForm } from './LoginForm';
import type { LoginFormProps } from './LoginForm';

function renderForm(props: Partial<LoginFormProps> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn();
  const view = render(
    <LoginForm
      signupHref="/inscription"
      forgotPasswordHref="/mot-de-passe-oublie"
      {...props}
      onSubmit={onSubmit}
    />,
  );
  return { ...view, onSubmit };
}

function emailInput(): HTMLInputElement {
  return screen.getByLabelText(/Adresse e-mail/);
}

function passwordInput(): HTMLInputElement {
  return screen.getByLabelText(/^Mot de passe/);
}

/**
 * Sans le CSS de Tailwind, jsdom ne masque pas le libellé de chargement (`invisible`) : il entre
 * dans le nom accessible calculé ici, ce que le navigateur ne fait pas. D'où la recherche par début.
 */
function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: /^Se connecter/ });
}

function form(): HTMLFormElement {
  const element = submitButton().form;
  if (!element) {
    throw new Error('Bouton hors formulaire');
  }
  return element;
}

function type(input: HTMLInputElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

describe('LoginForm', () => {
  describe('contenu', () => {
    it('affiche le titre, les liens, les deux champs et le bouton', () => {
      renderForm();

      expect(screen.getByRole('heading', { level: 1, name: 'Connexion' })).toBeDefined();
      expect(screen.getByRole('link', { name: 'Inscription' }).getAttribute('href')).toBe(
        '/inscription',
      );
      expect(screen.getByRole('link', { name: 'Mot de passe oublié ?' }).getAttribute('href')).toBe(
        '/mot-de-passe-oublie',
      );
      expect(emailInput().type).toBe('email');
      expect(passwordInput().type).toBe('password');
      expect(submitButton().className).toContain('w-full');
    });

    it('déclare l’autocomplétion attendue par les gestionnaires de mots de passe', () => {
      renderForm();

      expect(emailInput().getAttribute('autocomplete')).toBe('email');
      expect(emailInput().name).toBe('email');
      expect(passwordInput().getAttribute('autocomplete')).toBe('current-password');
      expect(passwordInput().name).toBe('password');
    });

    it('coupe la validation native du navigateur', () => {
      renderForm();

      expect(form().noValidate).toBe(true);
    });

    it('n’affiche pas de jauge de robustesse sur le mot de passe', () => {
      renderForm();
      type(passwordInput(), 'pikachu25');

      expect(screen.queryByText(/Faible|Correct|Solide/)).toBeNull();
    });

    it('n’affiche ni séparateur ni connexion sociale sans section sociale', () => {
      renderForm();

      expect(screen.queryByText('ou')).toBeNull();
    });

    it('affiche la section sociale sous le séparateur « ou »', () => {
      renderForm({ socialSection: <p>Boutons de connexion sociale</p> });

      expect(screen.getByText('ou')).toBeDefined();
      expect(screen.getByText('Boutons de connexion sociale')).toBeDefined();
    });

    it('affiche le message reçu en tête du formulaire', () => {
      renderForm({ notice: <p role="status">Votre session a expiré, reconnectez-vous.</p> });

      expect(screen.getByRole('status').textContent).toBe(
        'Votre session a expiré, reconnectez-vous.',
      );
    });
  });

  describe('validation', () => {
    it('valide chaque champ à sa sortie', () => {
      renderForm();

      fireEvent.blur(emailInput());
      fireEvent.blur(passwordInput());

      expect(screen.getByText('Saisissez votre adresse e-mail.')).toBeDefined();
      expect(screen.getByText('Saisissez votre mot de passe.')).toBeDefined();
      expect(emailInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('refuse une adresse mal formée à la sortie du champ', () => {
      renderForm();

      type(emailInput(), 'ash');
      fireEvent.blur(emailInput());

      expect(
        screen.getByText('Saisissez une adresse e-mail valide, par exemple nom@exemple.fr.'),
      ).toBeDefined();
    });

    it('efface le message dès que le champ en erreur est corrigé', () => {
      renderForm();
      fireEvent.blur(emailInput());
      fireEvent.blur(passwordInput());

      type(emailInput(), 'ash@exemple.fr');
      type(passwordInput(), 'pikachu25');

      expect(screen.queryByText('Saisissez votre adresse e-mail.')).toBeNull();
      expect(screen.queryByText('Saisissez votre mot de passe.')).toBeNull();
      expect(emailInput().getAttribute('aria-invalid')).toBeNull();
      expect(passwordInput().getAttribute('aria-invalid')).toBeNull();
    });
  });

  describe('envoi', () => {
    it('envoie l’e-mail sans espaces en bordure et le mot de passe tel quel', () => {
      const { onSubmit } = renderForm();

      type(emailInput(), '  ash@exemple.fr ');
      type(passwordInput(), ' pikachu25 ');
      fireEvent.click(submitButton());

      expect(onSubmit).toHaveBeenCalledWith({ email: 'ash@exemple.fr', password: ' pikachu25 ' });
    });

    it('s’envoie avec Entrée : bouton de type submit dans le formulaire', () => {
      const { onSubmit } = renderForm();
      type(emailInput(), 'ash@exemple.fr');
      type(passwordInput(), 'pikachu25');

      // jsdom ne simule pas l'envoi implicite par Entrée : il repose sur le bouton `submit`
      // du formulaire, vérifié ici, puis sur l'évènement `submit` déclenché par le navigateur.
      expect(submitButton().type).toBe('submit');
      fireEvent.submit(form());

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('place le focus sur le premier champ invalide sans envoyer', () => {
      const { onSubmit } = renderForm();

      fireEvent.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(emailInput());
      expect(screen.getByText('Saisissez votre adresse e-mail.')).toBeDefined();
      expect(screen.getByText('Saisissez votre mot de passe.')).toBeDefined();
    });

    it('place le focus sur le mot de passe quand seul lui est invalide', () => {
      const { onSubmit } = renderForm();
      type(emailInput(), 'ash@exemple.fr');

      fireEvent.click(submitButton());

      expect(onSubmit).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(passwordInput());
    });

    it('ne désactive jamais le bouton hors chargement', () => {
      const { rerender } = renderForm();
      expect(submitButton().disabled).toBe(false);

      fireEvent.click(submitButton());
      expect(submitButton().disabled).toBe(false);

      rerender(
        <LoginForm
          signupHref="/inscription"
          forgotPasswordHref="/mot-de-passe-oublie"
          onSubmit={vi.fn()}
          error="Adresse e-mail ou mot de passe incorrect."
        />,
      );
      expect(submitButton().disabled).toBe(false);
    });

    it('passe le bouton en chargement et ignore un nouvel envoi', () => {
      const { onSubmit } = renderForm({ submitting: true });
      type(emailInput(), 'ash@exemple.fr');
      type(passwordInput(), 'pikachu25');

      fireEvent.submit(form());

      expect(submitButton().getAttribute('aria-busy')).toBe('true');
      expect(submitButton().disabled).toBe(false);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('échec de connexion', () => {
    it('vide le mot de passe, garde l’e-mail et place le focus sur le mot de passe', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Connexion refusée'));
      renderForm({ onSubmit });
      type(emailInput(), 'ash@exemple.fr');
      type(passwordInput(), 'mauvais-mot-de-passe');

      await act(async () => {
        fireEvent.click(submitButton());
      });

      await waitFor(() => expect(passwordInput().value).toBe(''));
      expect(emailInput().value).toBe('ash@exemple.fr');
      expect(document.activeElement).toBe(passwordInput());
      expect(screen.queryByText('Saisissez votre mot de passe.')).toBeNull();
    });

    it('vide et refocalise le mot de passe à chaque nouvel échec', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Connexion refusée'));
      renderForm({ onSubmit });
      type(emailInput(), 'ash@exemple.fr');

      for (const attempt of ['essai-1', 'essai-2']) {
        type(passwordInput(), attempt);
        await act(async () => {
          fireEvent.click(submitButton());
        });
        await waitFor(() => expect(passwordInput().value).toBe(''));
        expect(document.activeElement).toBe(passwordInput());
      }
      expect(onSubmit).toHaveBeenCalledTimes(2);
    });

    it('affiche le message d’échec reçu dans une alerte', () => {
      renderForm({ error: 'Adresse e-mail ou mot de passe incorrect.' });

      expect(screen.getByRole('alert').textContent).toBe(
        'Adresse e-mail ou mot de passe incorrect.',
      );
    });

    it('garde les champs intacts quand l’envoi réussit', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      type(emailInput(), 'ash@exemple.fr');
      type(passwordInput(), 'pikachu25');

      await act(async () => {
        fireEvent.click(submitButton());
      });

      expect(passwordInput().value).toBe('pikachu25');
    });
  });
});
