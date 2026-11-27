import { useEffect, useRef, useState } from 'react';

import { Button, Text } from '@/components/atoms';
import { translateAuthError } from '@shared/utils';

import { APP_NAME } from '@shared/constants';

/** Délai avant d'afficher « Connexion… » : une restauration rapide passe sans libellé. */
export const STARTUP_LABEL_DELAY_MS = 1000;

/** Propriétés de StartupScreen. */
export interface StartupScreenProps {
  /** Erreur de la restauration, `null` pendant qu'elle est en cours. */
  error: unknown;
  /** Relance la restauration, depuis le bouton « Réessayer » de l'écran d'erreur. */
  onRetry: () => void;
}

/**
 * Écran affiché tant que la session est indéterminée (`unknown`) : fond Écrin, nom Collectionr en
 * fondu (`duration-signature`), puis « Connexion… » au-delà d'1 s. Jamais de spinner. Si la
 * restauration échoue (serveur injoignable…), le message d'erreur et « Réessayer » remplacent le
 * libellé. Après un « Réessayer » qui échoue, le focus revient sur « Réessayer ».
 */
export function StartupScreen({ error, onRetry }: StartupScreenProps) {
  const [revealed, setRevealed] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const alertRef = useRef<HTMLDivElement>(null);
  const retriedRef = useRef(false);
  const hasError = error !== null && error !== undefined;

  useEffect(() => {
    // Une image après le premier rendu : l'opacité nulle est peinte, la transition peut jouer.
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLabelVisible(true), STARTUP_LABEL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Pendant l'essai, l'écran d'erreur laisse la place au libellé et le bouton est démonté : sans
    // cela, le focus finirait sur `body`. Au premier affichage de l'erreur, il n'est pas déplacé.
    if (hasError && retriedRef.current) {
      retriedRef.current = false;
      alertRef.current?.querySelector('button')?.focus();
    }
  }, [hasError]);

  function handleRetry() {
    retriedRef.current = true;
    onRetry();
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-space-24 bg-ecrin p-space-24">
      <div
        className={`transition-opacity duration-signature ${revealed ? 'opacity-100' : 'opacity-0'}`}
      >
        <Text as="p" variant="h1">
          {APP_NAME}
        </Text>
      </div>
      {!hasError ? (
        <div role="status">
          {labelVisible && (
            <Text variant="caption" color="acier-texte">
              Connexion…
            </Text>
          )}
        </div>
      ) : (
        <div ref={alertRef} role="alert" className="flex flex-col items-center gap-space-16">
          <Text color="acier-texte" variant="body">
            {translateAuthError(error).message}
          </Text>
          <Button variant="primary" onClick={handleRetry}>
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
