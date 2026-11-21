/**
 * Dimensions fixes de composants en pixels, hors échelle d'espacement.
 * `control` : hauteur commune de Button et Input (COLLR-576, COLLR-578).
 * `badge` : hauteur et largeur minimale de Badge, l'interligne de la variante data (COLLR-599).
 * `sidebar` : largeur de Sidebar sur le web (COLLR-603).
 */
export const sizing = { control: 40, badge: 20, sidebar: 220 } as const;
