/**
 * Minuteries de l'environnement d'exécution : navigateurs et React Native les exposent, mais
 * `packages/shared` compile sans les types DOM et Node. Seul le sous-ensemble utilisé est typé ici.
 */
export interface RuntimeTimers {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

/**
 * Minuteries courantes, lues à chaque appel pour suivre un éventuel remplacement (minuteries
 * simulées des tests).
 */
export function runtimeTimers(): RuntimeTimers {
  return globalThis as unknown as RuntimeTimers;
}
