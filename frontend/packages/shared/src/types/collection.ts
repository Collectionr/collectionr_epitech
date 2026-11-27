import type { CARD_CONDITIONS, CARD_LANGUAGES } from '../constants/cardEntry';
import type { CardView, SetView, VariantView } from './catalog';

/** État physique déclaré d'une carte (NM, LP, MP, HP, DMG). */
export type CardCondition = (typeof CARD_CONDITIONS)[number];

/** Langue d'une carte physique. */
export type CardLanguage = (typeof CARD_LANGUAGES)[number];

/** Collection de l'utilisateur, telle que l'API la renvoie (`CollectionResponseDto`). */
export interface Collection {
  /** Identifiant (UUID) */
  id: string;
  /** Licence de la collection (Pokémon…), fixée à la création */
  licenceTCGId: string;
  /** Nom, unique par utilisateur (1 à 60 caractères) */
  name: string;
  /** Date de création, au format ISO 8601 */
  createdAt: string;
  /** Date de dernière modification, au format ISO 8601 */
  updatedAt: string;
}

/** Ligne d'une collection : des exemplaires d'une carte, dans un état et une langue (`CardEntryResponseDto`). */
export interface CardEntry {
  /** Identifiant (UUID) */
  id: string;
  /** Collection de la ligne */
  collectionId: string;
  /** Carte du catalogue */
  cardId: string;
  /** Impression de la carte, si elle est connue */
  variantId: string | null;
  /** Nombre d'exemplaires */
  quantity: number;
  /** État physique déclaré */
  condition: CardCondition;
  /** Langue de la carte physique */
  language: CardLanguage;
  /** Note de gradage (0 à 10), si elle existe */
  gradingNote: number | null;
  /** Notes libres, si elles existent */
  notes: string | null;
  /** Date d'ajout, au format ISO 8601 */
  addedAt: string;
  /** Date de dernière modification, au format ISO 8601 */
  updatedAt: string;
}

/** Ligne d'une collection avec les données du catalogue pour l'afficher (`CardEntryViewResponseDto`). */
export interface CardEntryView extends CardEntry {
  /** Carte */
  card: CardView;
  /** Set de la carte */
  set: SetView;
  /** Impression, si elle est connue */
  variant: VariantView | null;
}

/** Page de lignes d'une collection (`GET /collections/:id/cards`). */
export interface CollectionCardsPage {
  /** Lignes de la page, les plus récentes d'abord */
  items: CardEntryView[];
  /** Nombre de lignes de toute la collection */
  total: number;
  /** Numéro de la page, à partir de 1 */
  page: number;
  /** Taille de page demandée */
  pageSize: number;
}

/** Carte à ajouter à une collection (`POST /collections/:id/cards`). */
export interface AddCardEntryInput {
  /** Carte du catalogue, de la licence de la collection */
  cardId: string;
  /** Impression de la carte, si elle est connue */
  variantId?: string | null;
  /** Nombre d'exemplaires (1 à 9999) */
  quantity: number;
  /** État physique déclaré */
  condition: CardCondition;
  /** Langue de la carte physique */
  language: CardLanguage;
}
