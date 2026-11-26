/** Carte du catalogue, telle que l'API l'expose (`CardViewDto`). */
export interface CardView {
  /** Identifiant (UUID) */
  id: string;
  /** Numéro dans le set, tel qu'imprimé (« 4 », « 006 », « TG01 ») */
  number: string;
  /** Nom anglais */
  nameEn: string;
  /** Nom français, s'il existe */
  nameFr: string | null;
  /** Catégorie, code anglais (Pokemon, Trainer, Energy) traduit par le front */
  category: string;
  /** Rareté, code anglais (« Holo Rare »), s'il est connu */
  rarity: string | null;
  /** Base de l'URL de l'image anglaise, sans extension (ajouter `/low.webp` ou `/high.webp`) */
  imageUrlEn: string | null;
  /** Base de l'URL de l'image française, sans extension */
  imageUrlFr: string | null;
}

/** Set (extension) d'une carte, tel que l'API l'expose (`SetViewDto`). */
export interface SetView {
  /** Identifiant (UUID) */
  id: string;
  /** Identifiant TCGdex du set (« base1 », « swsh3 ») */
  tcgdexId: string;
  /** Nom anglais */
  nameEn: string;
  /** Nom français, s'il existe */
  nameFr: string | null;
  /** Abréviation officielle (« BS », « DAA »), si elle est connue */
  abbreviationOfficial: string | null;
}

/** Impression d'une carte (holo, reverse…), telle que l'API l'expose (`VariantViewDto`). */
export interface VariantView {
  /** Identifiant (UUID) */
  id: string;
  /** Type d'impression (« holo », « normal », « reverse ») */
  type: string;
  /** Sous-type (« unlimited », « shadowless »), s'il existe */
  subtype: string | null;
  /** Format (« standard », « jumbo ») */
  size: string;
  /** Tampons (« 1st-edition ») */
  stamps: string[];
  /** Type de brillance (« gold »), s'il existe */
  foil: string | null;
}

/**
 * Carte trouvée dans le catalogue, avec son set et ses impressions (résultat de recherche).
 * Forme supposée : aucun endpoint de recherche n'existe encore côté back (COLLR-459). Elle reprend
 * les vues déjà exposées par l'API (`CardViewDto`, `SetViewDto`, `VariantViewDto`).
 */
export interface CatalogCard {
  /** Carte */
  card: CardView;
  /** Set de la carte */
  set: SetView;
  /** Impressions de la carte */
  variants: VariantView[];
}
