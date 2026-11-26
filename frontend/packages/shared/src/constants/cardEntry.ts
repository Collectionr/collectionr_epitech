/**
 * États physiques déclarés d'une carte, codes du back (`CardCondition.ts` du module collection,
 * énumération du Swagger) : Near Mint, Lightly Played, Moderately Played, Heavily Played, Damaged.
 * L'API ne les expose par aucun endpoint : cette liste doit suivre celle du back.
 */
export const CARD_CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'] as const;

/**
 * Langues d'une carte physique, codes du back (`CardLanguage.ts`, énumération du Swagger) :
 * français et anglais uniquement en V1.
 */
export const CARD_LANGUAGES = ['fr', 'en'] as const;

/** Bornes de la quantité d'une ligne de collection, celles du back (`CollectionLimits.ts`). */
export const CARD_ENTRY_QUANTITY = { min: 1, max: 9999 } as const;

/** Lignes d'une collection par page, la valeur par défaut du back (100 au maximum). */
export const COLLECTION_CARDS_PAGE_SIZE = 50;
