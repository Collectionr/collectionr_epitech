import { useEffect } from 'react';

import { useNavigate } from 'react-router';

/** Bouton principal de la souris (`MouseEvent.button`). */
const PRIMARY_BUTTON = 0;

/** Sous-ensemble de `MouseEvent` lu pour décider de l'interception. */
export interface LinkClickEvent {
  readonly defaultPrevented: boolean;
  readonly button: number;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly target: EventTarget | null;
}

/**
 * Chemin interne vers lequel naviguer pour ce clic, ou `null` si le navigateur doit le traiter
 * normalement : clic déjà traité (lien du routeur), autre bouton ou touche de modification
 * (nouvel onglet, nouvelle fenêtre, téléchargement), `target` autre que `_self`, attribut
 * `download`, `rel="external"`, ou lien vers une autre origine.
 * @param event - Clic reçu
 * @param currentOrigin - Origine de l'application (`window.location.origin`)
 */
export function getInternalLinkPath(event: LinkClickEvent, currentOrigin: string): string | null {
  if (
    event.defaultPrevented ||
    event.button !== PRIMARY_BUTTON ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return null;
  }
  const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }
  const target = anchor.getAttribute('target');
  if (
    (target !== null && target !== '' && target !== '_self') ||
    anchor.hasAttribute('download') ||
    anchor.relList.contains('external')
  ) {
    return null;
  }
  const url = new URL(anchor.href);
  if (url.origin !== currentOrigin) {
    return null;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Fait passer par le routeur les clics sur les liens internes en `<a href>` natif (NavItem,
 * fil d'Ariane de Topbar, liens des formulaires) : la page change sans recharger l'application,
 * donc sans nouveau renouvellement de session. Les composants restent indépendants du routeur.
 * À monter une seule fois, à la racine des routes.
 */
export function useInternalLinkNavigation(): void {
  const navigate = useNavigate();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const path = getInternalLinkPath(event, window.location.origin);
      if (path !== null) {
        event.preventDefault();
        void navigate(path);
      }
    }

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigate]);
}
