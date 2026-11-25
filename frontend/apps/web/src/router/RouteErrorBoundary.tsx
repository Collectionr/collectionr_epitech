import { Component } from 'react';
import type { ReactNode } from 'react';

import { useQueryErrorResetBoundary } from '@tanstack/react-query';

import { Button, Text } from '@/components/atoms';

/** Propriétés de RouteErrorBoundary. */
export interface RouteErrorBoundaryProps {
  /** Contenu de la route protégé par la boundary. */
  children: ReactNode;
}

interface BoundaryProps extends RouteErrorBoundaryProps {
  /** Appelé avant un nouvel essai, pour relancer les requêtes en erreur. */
  onReset: () => void;
}

interface BoundaryState {
  hasError: boolean;
}

/** Les error boundaries React n'existent qu'en composant classe. */
class Boundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  private readonly handleRetry = () => {
    this.props.onReset();
    this.setState({ hasError: false });
  };

  override render() {
    if (!this.state.hasError) {
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
 * « Réessayer » relance les requêtes en erreur puis rend la route à nouveau.
 */
export function RouteErrorBoundary({ children }: RouteErrorBoundaryProps) {
  const { reset } = useQueryErrorResetBoundary();

  return <Boundary onReset={reset}>{children}</Boundary>;
}
