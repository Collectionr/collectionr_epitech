/** The languages of the V1 catalogue (CDC: French and English, Japanese is out of scope). */
export const CATALOGUE_LANGUAGES = ['en', 'fr'] as const;

export type CatalogueLanguage = (typeof CATALOGUE_LANGUAGES)[number];
