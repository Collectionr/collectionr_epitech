import { Button, Text } from '@/components/atoms';

import { ROUTES } from './routes';
import { useDocumentTitle } from './useDocumentTitle';

/** Propriétés de RootErrorScreen. */
export interface RootErrorScreenProps {
  /** Recharge la page ; `window.location.reload` par défaut, remplaçable en test. */
  reload?: () => void;
}

function reloadPage() {
  window.location.reload();
}

/**
 * Écran d'erreur de la route racine (`errorElement`) : une erreur qui sort des pages, que
 * `RouteErrorBoundary` ne voit pas (gardes, restauration de la session, navigation refusée par le
 * routeur), affiche cet écran en français au lieu de l'écran technique de React Router. La racine
 * étant remplacée, seul un rechargement permet de réessayer ; le lien vers le Dashboard recharge
 * aussi l'application, sur une autre adresse.
 */
export function RootErrorScreen({ reload = reloadPage }: RootErrorScreenProps) {
  useDocumentTitle('Erreur');

  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-space-16 bg-ecrin p-space-24 text-center"
    >
      <Text variant="h1">Une erreur est survenue</Text>
      <Text color="acier-texte" variant="body">
        L’application n’a pas pu afficher cette page. Rechargez-la pour réessayer.
      </Text>
      <Button variant="primary" onClick={reload}>
        Recharger la page
      </Button>
      <a href={ROUTES.dashboard} className="underline decoration-acier-texte">
        <Text as="span" variant="body">
          Retour au Dashboard
        </Text>
      </a>
    </main>
  );
}
