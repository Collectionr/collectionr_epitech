import { useEffect, useState } from 'react';

import { Text } from '@/components/atoms';

/** Délai avant d'afficher « Chargement… » : en dessous, l'attente reste imperceptible. */
export const LOADING_LABEL_DELAY_MS = 400;

/**
 * Attente du chargement d'une page : rien pendant 400 ms, puis « Chargement… » en caption
 * `acier-texte`. Jamais de spinner.
 */
export function DelayedLoadingLabel() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), LOADING_LABEL_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div role="status" className="p-space-24">
      {visible && (
        <Text variant="caption" color="acier-texte">
          Chargement…
        </Text>
      )}
    </div>
  );
}
