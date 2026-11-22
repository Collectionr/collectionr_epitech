/**
 * Dimensions fixes de composants en pixels, hors échelle d'espacement.
 * `control` : hauteur commune de Button et Input (COLLR-576, COLLR-578).
 * `badge` : hauteur et largeur minimale de Badge, l'interligne de la variante data (COLLR-599).
 * `form` : largeur maximale de la colonne formulaire d'AuthLayout (COLLR-586). Valeur provisoire,
 * décision PO du 21/11/2026, à confirmer dans Figma (Inscription V2, nœud 684:7).
 */
export const sizing = { control: 40, badge: 20, form: 480 } as const;
