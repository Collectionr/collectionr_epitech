/** Arrondis en pixels : seule une surface de carte peut être arrondie. */
export const radius = { none: 0, card: 6 } as const;

/** Ratio physique des vignettes de cartes TCG. */
export const aspectRatio = { card: '63 / 88' } as const;
