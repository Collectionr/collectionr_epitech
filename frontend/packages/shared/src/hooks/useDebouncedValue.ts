import { useEffect, useState } from 'react';

import { runtimeTimers } from '../utils/runtimeTimers';

/**
 * Valeur reprise seulement après un temps sans changement : la frappe en cours ne déclenche rien.
 * @param value - Valeur courante
 * @param delayMs - Temps sans changement à attendre, en millisecondes
 * @returns La dernière valeur restée stable pendant `delayMs`
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timers = runtimeTimers();
    const timer = timers.setTimeout(() => setDebounced(value), delayMs);
    return () => timers.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
