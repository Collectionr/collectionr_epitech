import type { Ref } from 'react';

/**
 * Affecte un nœud à une référence reçue en propriété, objet ou fonction : pour un composant qui
 * garde sa propre référence et transmet aussi le nœud à son parent.
 * @param ref - Référence fournie par le parent, éventuellement absente
 * @param node - Nœud monté, ou `null` au démontage
 */
export function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') {
    ref(node);
  } else if (ref) {
    ref.current = node;
  }
}
