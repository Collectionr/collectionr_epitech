import { Text } from '@/components/atoms';

/** Message affiché sur la connexion quand la session vient d'expirer en cours d'usage. */
export function SessionExpiredNotice() {
  return (
    <div role="status" className="px-space-24 pt-space-24">
      <Text variant="body">Votre session a expiré, reconnectez-vous.</Text>
    </div>
  );
}
