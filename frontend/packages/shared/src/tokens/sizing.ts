/**
 * Dimensions fixes de composants en pixels, hors échelle d'espacement.
 * `control` : hauteur commune de Button et Input (COLLR-576, COLLR-578).
 * `control-compact` : hauteur d'Input dans SearchBar (COLLR-602).
 * `badge` : hauteur et largeur minimale de Badge, l'interligne de la variante data (COLLR-599).
 * `form` : largeur maximale de la colonne formulaire d'AuthLayout (COLLR-586). Valeur provisoire,
 * décision PO du 21/11/2026, à confirmer dans Figma (Inscription V2, nœud 684:7).
 * `sidebar` : largeur de Sidebar sur le web (COLLR-603).
 */
export const sizing = {
  control: 40,
  'control-compact': 32,
  badge: 20,
  form: 480,
  sidebar: 220,
} as const;
