import { createContext, useContext, useLayoutEffect } from 'react';

import { useLocation } from 'react-router';

import { useDocumentTitle } from './useDocumentTitle';

/**
 * Reçoit le titre de la page affichée, pour la Topbar du cadre des pages connectées.
 * @param pathname - Chemin de la page qui fournit le titre
 * @param title - Nom de la page
 */
export type PageTitleSetter = (pathname: string, title: string) => void;

/** Fourni par `ConnectedLayout` ; absent hors du cadre des pages connectées. */
export const PageTitleContext = createContext<PageTitleSetter | null>(null);

/**
 * Titre de la page affichée : titre de l'onglet, et titre de la Topbar dans le cadre des pages
 * connectées. Le titre est fourni par la page, jamais déduit du chemin.
 * @param title - Nom de la page
 * @returns `true` si le cadre affiche déjà le titre (en `h1` dans la Topbar) : la page ne le répète pas
 */
export function usePageTitle(title: string): boolean {
  useDocumentTitle(title);
  const setPageTitle = useContext(PageTitleContext);
  const { pathname } = useLocation();

  // Avant l'affichage : la Topbar ne montre jamais le titre de la page précédente.
  useLayoutEffect(() => {
    setPageTitle?.(pathname, title);
  }, [setPageTitle, pathname, title]);

  return setPageTitle !== null;
}
