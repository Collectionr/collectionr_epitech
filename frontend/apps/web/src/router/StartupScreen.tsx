import { useEffect, useState } from 'react';

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
 * libellé.
 */
export function StartupScreen({ error, onRetry }: StartupScreenProps) {
  const [revealed, setRevealed] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);

  useEffect(() => {
    // Une image après le premier rendu : l'opacité nulle est peinte, la transition peut jouer.
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setLabelVisible(true), STARTUP_LABEL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-space-24 bg-ecrin p-space-24">
      <div
        className={`transition-opacity duration-signature ${revealed ? 'opacity-100' : 'opacity-0'}`}
      >
        <Text as="p" variant="h1">
          {APP_NAME}
        </Text>
      </div>
      {error === null || error === undefined ? (
        <div role="status">
          {labelVisible && (
            <Text variant="caption" color="acier-texte">
              Connexion…
            </Text>
          )}
        </div>
      ) : (
        <div role="alert" className="flex flex-col items-center gap-space-16">
          <Text color="acier-texte" variant="body">
            {translateAuthError(error).message}
          </Text>
          <Button variant="primary" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      )}
    </div>
  );
}
