import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent, ReactNode } from 'react';

import { Button, Text } from '@/components/atoms';
import { FormField, PasswordField } from '@/components/molecules';
import { validateEmail, validateLoginPassword } from '@shared/validation';

/** Valeurs envoyées par LoginForm, déjà validées. */
export interface LoginFormValues {
  /** Adresse e-mail, sans espaces en bordure. */
  email: string;
  /** Mot de passe, tel que saisi. */
  password: string;
}

/** Propriétés de LoginForm. */
export interface LoginFormProps {
  /**
   * Appelé à l'envoi, avec des valeurs valides. Si la promesse renvoyée est rejetée (connexion
   * refusée), le mot de passe est vidé et reçoit le focus ; le message vient de `error`.
   */
  onSubmit: (values: LoginFormValues) => Promise<unknown> | void;
  /** Connexion en cours : bouton en chargement, nouvel envoi ignoré. */
  submitting?: boolean;
  /** Message explicite du dernier échec de connexion, déjà traduit. */
  error?: string;
  /** Destination du lien « Inscription ». */
  signupHref: string;
  /** Destination du lien « Mot de passe oublié ? ». */
  forgotPasswordHref: string;
  /** Message affiché en tête du formulaire (session expirée…). */
  notice?: ReactNode;
  /** Connexion sociale, sous le séparateur « ou » ; sans elle, ni séparateur ni boutons. */
  socialSection?: ReactNode;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const LINK_CLASSES = 'underline decoration-acier-texte';

function validate(values: LoginFormValues): FieldErrors {
  return {
    email: validateEmail(values.email),
    password: validateLoginPassword(values.password),
  };
}

/**
 * Formulaire de connexion, dans le panneau formulaire d'AuthLayout. Il reçoit l'état de l'envoi et
 * l'erreur par props et n'appelle aucun hook de données. Validation à la sortie de chaque champ
 * et à l'envoi : le focus va alors au premier champ invalide. Le bouton n'est jamais désactivé
 * hors chargement, pour que l'envoi explique toujours ce qui manque. La validation native du
 * navigateur est coupée (`noValidate`) au profit des messages du formulaire.
 */
export function LoginForm({
  onSubmit,
  submitting = false,
  error,
  signupHref,
  forgotPasswordHref,
  notice,
  socialSection,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    const { value } = event.target;
    setEmail(value);
    // Un champ déjà en erreur se revalide à la saisie : le message disparaît dès qu'il est corrigé.
    if (errors.email !== undefined) {
      setErrors((current) => ({ ...current, email: validateEmail(value) }));
    }
  }

  function handlePasswordChange(event: ChangeEvent<HTMLInputElement>) {
    const { value } = event.target;
    setPassword(value);
    if (errors.password !== undefined) {
      setErrors((current) => ({ ...current, password: validateLoginPassword(value) }));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    const values = { email: email.trim(), password };
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (nextErrors.email !== undefined) {
      emailRef.current?.focus();
      return;
    }
    if (nextErrors.password !== undefined) {
      passwordRef.current?.focus();
      return;
    }

    try {
      await onSubmit(values);
    } catch {
      // Connexion refusée : l'e-mail reste, le mot de passe est à ressaisir. Le message affiché
      // vient de la prop `error`, fournie par la page.
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-space-24">
      {notice}

      <div className="flex flex-col gap-space-8">
        <Text as="h1" variant="h2">
          Connexion
        </Text>
        <Text color="acier-texte" variant="body">
          Pas encore de compte ?{' '}
          <a href={signupHref} className={`text-archive ${LINK_CLASSES}`}>
            Inscription
          </a>
        </Text>
      </div>

      <div className="flex flex-col gap-space-8">
        <FormField
          label="Adresse e-mail"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          error={errors.email}
          ref={emailRef}
          onChange={handleEmailChange}
          onBlur={() => setErrors((current) => ({ ...current, email: validateEmail(email) }))}
        />
        <FormField
          label="Mot de passe"
          required
          error={errors.password}
          renderControl={(control) => (
            <PasswordField
              {...control}
              name="password"
              autoComplete="current-password"
              value={password}
              ref={passwordRef}
              onChange={handlePasswordChange}
              onBlur={() =>
                setErrors((current) => ({ ...current, password: validateLoginPassword(password) }))
              }
            />
          )}
        />
        <a href={forgotPasswordHref} className={`self-end ${LINK_CLASSES}`}>
          <Text as="span" variant="caption" color="acier-texte">
            Mot de passe oublié ?
          </Text>
        </a>
      </div>

      <div className="flex flex-col gap-space-16">
        <div role="alert">
          {error !== undefined && error !== '' && (
            <Text color="alerte" variant="body">
              {error}
            </Text>
          )}
        </div>
        <Button
          type="submit"
          variant="primary"
          fullWidth
          loading={submitting}
          loadingLabel="Connexion…"
        >
          Se connecter
        </Button>
      </div>

      {socialSection !== undefined && (
        <>
          <div className="flex items-center gap-space-12">
            <span aria-hidden="true" className="flex-1 border-t border-lisere" />
            <Text variant="caption" color="acier-texte">
              ou
            </Text>
            <span aria-hidden="true" className="flex-1 border-t border-lisere" />
          </div>
          {socialSection}
        </>
      )}
    </form>
  );
}
