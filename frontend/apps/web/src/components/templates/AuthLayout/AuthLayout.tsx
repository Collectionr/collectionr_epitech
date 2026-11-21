import type { ReactNode } from 'react';

/** Propriétés d'AuthLayout. */
export interface AuthLayoutProps {
  /**
   * Contenu du panneau de marque (BrandPanel), fourni par la page : argumentaire de l'inscription,
   * contenu plus neutre pour la connexion. Masqué sous le seuil desktop (1280 px).
   */
  brandPanel: ReactNode;
  /** Contenu du panneau formulaire (FormPanel) : SignupForm ou LoginForm. */
  formPanel: ReactNode;
}

/** Hauteur de l'écran au minimum : la page s'allonge avec un formulaire plus haut que la fenêtre. */
const ROOT_CLASSES = 'flex min-h-dvh';

/**
 * Masqué sous le seuil desktop plutôt que compressé ; au-delà, une colonne sur deux.
 * `display: none` le retire aussi de l'arbre d'accessibilité.
 */
const BRAND_PANEL_CLASSES =
  'hidden desktop:flex desktop:w-1/2 flex-col bg-ecrin-elevated p-space-64';

const FORM_PANEL_CLASSES =
  'flex flex-1 flex-col justify-center px-space-24 py-space-48 desktop:px-space-64';

/**
 * Colonne du formulaire : toute la largeur disponible jusqu'au token `sizing.form` (`max-w-form`),
 * centrée dans son panneau au-delà.
 */
const FORM_COLUMN_CLASSES = 'mx-auto w-full max-w-form';

/**
 * Mise en page commune à l'inscription et à la connexion (Inscription V2, node Figma 684:7) :
 * panneau de marque à gauche, panneau formulaire à droite. Template pur : ni donnée, ni hook,
 * ni variante par écran ; la page fournit le contenu des deux emplacements.
 *
 * Le formulaire est la zone principale de la page (`<main>`) ; le panneau de marque, contenu
 * complémentaire (`<aside>`), disparaît sous le seuil desktop.
 */
export function AuthLayout({ brandPanel, formPanel }: AuthLayoutProps) {
  return (
    <div className={ROOT_CLASSES}>
      <aside className={BRAND_PANEL_CLASSES}>{brandPanel}</aside>
      <main className={FORM_PANEL_CLASSES}>
        <div className={FORM_COLUMN_CLASSES}>{formPanel}</div>
      </main>
    </div>
  );
}
