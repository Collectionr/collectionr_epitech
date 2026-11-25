import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { useSessionExpiredNotice } from '@shared/hooks';

import { SessionExpiredNotice } from './SessionExpiredNotice';

/** Connexion (COLLR-597). Page provisoire, avec le message de session expirée (COLLR-700). */
export function LoginPage() {
  const sessionExpired = useSessionExpiredNotice();

  return (
    <>
      {sessionExpired && <SessionExpiredNotice />}
      <PlaceholderPage title="Connexion" />
    </>
  );
}
