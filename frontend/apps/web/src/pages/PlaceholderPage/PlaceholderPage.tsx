import { Text } from '@/components/atoms';
import { usePageTitle } from '@/router/usePageTitle';

/** Propriétés de PlaceholderPage. */
export interface PlaceholderPageProps {
  /** Nom de la page, affiché en titre et dans l'onglet. */
  title: string;
}

const MESSAGE = 'Cette page arrive bientôt.';

/**
 * Page pas encore construite : son titre et une phrase, sans faux contenu. Dans le cadre des pages
 * connectées, le titre est affiché par la Topbar et la zone de contenu est déjà le `<main>` :
 * la page n'affiche que la phrase.
 */
export function PlaceholderPage({ title }: PlaceholderPageProps) {
  const titleShownByFrame = usePageTitle(title);

  if (titleShownByFrame) {
    return (
      <div className="p-space-24">
        <Text color="acier-texte" variant="body">
          {MESSAGE}
        </Text>
      </div>
    );
  }

  return (
    <main className="flex flex-col gap-space-8 p-space-24">
      <Text variant="h1">{title}</Text>
      <Text color="acier-texte" variant="body">
        {MESSAGE}
      </Text>
    </main>
  );
}
