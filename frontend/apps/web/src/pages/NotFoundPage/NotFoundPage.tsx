import { Link } from 'react-router';

import { Text } from '@/components/atoms';
import { ROUTES } from '@/router/routes';
import { useDocumentTitle } from '@/router/useDocumentTitle';

/** Page 404 : l'adresse ne correspond à aucune page (WF-D10). */
export function NotFoundPage() {
  useDocumentTitle('Page introuvable');

  return (
    <main className="flex flex-col items-start gap-space-16 p-space-24">
      <Text variant="h1">Page introuvable</Text>
      <Text color="acier-texte" variant="body">
        Cette page n’existe pas ou a été déplacée.
      </Text>
      <Link to={ROUTES.dashboard} className="underline decoration-acier-texte">
        <Text as="span" variant="body">
          Retour au Dashboard
        </Text>
      </Link>
    </main>
  );
}
