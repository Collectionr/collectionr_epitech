import { Text } from '@/components/atoms';
import { LoginForm } from '@/components/organisms';
import { AuthLayout } from '@/components/templates';
import { useDocumentTitle } from '@/router/useDocumentTitle';
import { useLogin, useSessionExpiredNotice } from '@shared/hooks';

import { ROUTES } from '@/router/routes';
import { APP_NAME } from '@shared/constants';
import { translateAuthError } from '@shared/utils';

import { SessionExpiredNotice } from './SessionExpiredNotice';

/**
 * Connexion (UC-01) : AuthLayout et LoginForm, seule page à appeler `useLogin`. Elle ne navigue
 * pas après une connexion réussie : la garde des pages visiteurs (`RedirectIfAuthenticated`)
 * envoie vers la page demandée (`redirect`), sinon vers le Dashboard.
 */
export function LoginPage() {
  useDocumentTitle('Connexion');
  const login = useLogin();
  const sessionExpired = useSessionExpiredNotice();

  return (
    <AuthLayout
      brandPanel={
        <Text as="p" variant="h1">
          {APP_NAME}
        </Text>
      }
      formPanel={
        <LoginForm
          onSubmit={(credentials) => login.mutateAsync(credentials)}
          submitting={login.isPending}
          error={login.error ? translateAuthError(login.error).message : undefined}
          signupHref={ROUTES.signup}
          forgotPasswordHref={ROUTES.forgotPassword}
          notice={sessionExpired ? <SessionExpiredNotice /> : undefined}
        />
      }
    />
  );
}
