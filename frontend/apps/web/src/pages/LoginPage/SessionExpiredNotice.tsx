import { Text } from '@/components/atoms';

/** Message affiché en tête de la connexion quand la session vient d'expirer en cours d'usage. */
export function SessionExpiredNotice() {
  return (
    <div role="status">
      <Text variant="body">Votre session a expiré, reconnectez-vous.</Text>
    </div>
  );
}
