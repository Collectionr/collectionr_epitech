import { Text } from '@/components/atoms';
import { useDocumentTitle } from '@/router/useDocumentTitle';

/** Propriétés de PlaceholderPage. */
export interface PlaceholderPageProps {
  /** Nom de la page, affiché en titre et dans l'onglet. */
  title: string;
}

/** Page pas encore construite : son titre et une phrase, sans faux contenu. */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  useDocumentTitle(title);

  return (
    <main className="flex flex-col gap-space-8 p-space-24">
      <Text variant="h1">{title}</Text>
      <Text color="acier-texte" variant="body">
        Cette page arrive bientôt.
      </Text>
    </main>
  );
}
