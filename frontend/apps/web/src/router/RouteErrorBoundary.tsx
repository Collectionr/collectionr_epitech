import { Component } from 'react';
import type { ReactNode } from 'react';

import { useQueryErrorResetBoundary } from '@tanstack/react-query';

import { Button, Text } from '@/components/atoms';

import { isDynamicImportError } from './dynamicImportError';

/** Propriétés de RouteErrorBoundary. */
export interface RouteErrorBoundaryProps {
  /** Contenu de la route protégé par la boundary. */
  children: ReactNode;
  /** Recharge la page ; `window.location.reload` par défaut, remplaçable en test. */
  reload?: () => void;
}

interface BoundaryProps {
  children: ReactNode;
  /** Appelé avant un nouvel essai, pour relancer les requêtes en erreur. */
  onReset: () => void;
  /** Recharge la page, seul nouvel essai possible après l'échec de l'import d'une page. */
  reload: () => void;
}

interface BoundaryState {
  /** Erreur interceptée, `null` tant que la route s'affiche. */
  error: unknown;
}

function reloadPage() {
  window.location.reload();
}

/** Les error boundaries React n'existent qu'en composant classe. */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): BoundaryState {
    // Une valeur levée `undefined` ou `null` reste une erreur à afficher.
    return { error: error ?? new Error('Erreur sans valeur') };
  }

  private readonly handleRetry = () => {
    // React garde l'échec d'un `lazy()` en mémoire : rendre la route à nouveau relancerait la même
    // erreur. Seul un rechargement relance l'import de la page.
    if (isDynamicImportError(this.state.error)) {
      this.props.reload();
      return;
    }
    this.props.onReset();
    this.setState({ error: null });
  };

  override render() {
    if (this.state.error === null) {
      return this.props.children;
    }

    return (
      <div role="alert" className="flex flex-col items-start gap-space-16 p-space-24">
        <Text as="h2" variant="h2">
          Cette page n’a pas pu s’afficher
        </Text>
        <Text color="acier-texte" variant="body">
          Vérifiez votre connexion, puis réessayez.
        </Text>
        <Button variant="primary" onClick={this.handleRetry}>
          Réessayer
        </Button>
      </div>
    );
  }
}

/**
 * Error boundary d'une route : une erreur de rendu, de chargement de la page ou d'une requête
 * affiche un écran d'erreur avec « Réessayer » à la place de la route, jamais un écran blanc.
 * « Réessayer » relance les requêtes en erreur puis rend la route à nouveau ; si c'est l'import de
 * la page qui a échoué, il recharge la page.
 */
export function RouteErrorBoundary({ children, reload = reloadPage }: RouteErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <Boundary onReset={reset} reload={reload}>
      {children}
    </Boundary>
  );
}
