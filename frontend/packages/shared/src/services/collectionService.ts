import {
  CARD_CONDITIONS,
  CARD_LANGUAGES,
  COLLECTION_CARDS_PAGE_SIZE,
} from '../constants/cardEntry';
import type {
  AddCardEntryInput,
  CardEntry,
  CardEntryView,
  CardView,
  Collection,
  CollectionCardsPage,
  SetView,
  VariantView,
} from '../types';
import type { ApiClient, ApiPath } from './apiClient';
import {
  readField,
  readNullableNumber,
  readNullableString,
  readNumber,
  readOneOf,
  readString,
  readStringArray,
  requireFields,
  unexpectedResponse,
} from './responseReaders';

/**
 * Collections de l'utilisateur connecté et leurs cartes. Chaque réponse est vérifiée avant d'être
 * renvoyée typée : une forme inattendue lève une `TypeError` (contrat de l'API rompu).
 */
export interface CollectionService {
  /**
   * Collections de l'utilisateur, les plus récentes d'abord (`GET /collections`, non paginé).
   * @throws {ApiError} Si l'API refuse la requête
   * @throws {NetworkError} Si le serveur est injoignable
   */
  list(): Promise<Collection[]>;
  /**
   * Une page des cartes d'une collection, les plus récentes d'abord (`GET /collections/:id/cards`).
   * L'API ne propose ni tri ni recherche.
   * @param collectionId - Collection
   * @param page - Numéro de la page, à partir de 1
   * @throws {ApiError} 404 si la collection n'existe pas ou appartient à un autre utilisateur
   */
  listCards(collectionId: string, page: number): Promise<CollectionCardsPage>;
  /**
   * Ajoute une carte à une collection (`POST /collections/:id/cards`). Chaque appel crée une
   * nouvelle ligne : la même carte ajoutée deux fois donne deux lignes, jamais fusionnées.
   * @param collectionId - Collection de destination
   * @param input - Carte, quantité, état et langue
   * @returns La ligne créée, sans les données du catalogue
   * @throws {ApiError} 400 si les données sont refusées, 404 si la collection ou la carte est inconnue
   */
  addCard(collectionId: string, input: AddCardEntryInput): Promise<CardEntry>;
}

/** Options de création du service. */
export interface CollectionServiceOptions {
  /** Client API de l'application */
  client: ApiClient;
}

function collectionPath(collectionId: string): ApiPath {
  return `/collections/${encodeURIComponent(collectionId)}`;
}

function parseCollection(value: unknown, path: string): Collection {
  return requireFields(
    {
      id: readString(value, 'id'),
      licenceTCGId: readString(value, 'licenceTCGId'),
      name: readString(value, 'name'),
      createdAt: readString(value, 'createdAt'),
      updatedAt: readString(value, 'updatedAt'),
    },
    path,
  );
}

function parseCardEntry(value: unknown, path: string): CardEntry {
  return requireFields(
    {
      id: readString(value, 'id'),
      collectionId: readString(value, 'collectionId'),
      cardId: readString(value, 'cardId'),
      variantId: readNullableString(value, 'variantId'),
      quantity: readNumber(value, 'quantity'),
      condition: readOneOf(value, 'condition', CARD_CONDITIONS),
      language: readOneOf(value, 'language', CARD_LANGUAGES),
      gradingNote: readNullableNumber(value, 'gradingNote'),
      notes: readNullableString(value, 'notes'),
      addedAt: readString(value, 'addedAt'),
      updatedAt: readString(value, 'updatedAt'),
    },
    path,
  );
}

function parseCardView(value: unknown, path: string): CardView {
  return requireFields(
    {
      id: readString(value, 'id'),
      number: readString(value, 'number'),
      nameEn: readString(value, 'nameEn'),
      nameFr: readNullableString(value, 'nameFr'),
      category: readString(value, 'category'),
      rarity: readNullableString(value, 'rarity'),
      imageUrlEn: readNullableString(value, 'imageUrlEn'),
      imageUrlFr: readNullableString(value, 'imageUrlFr'),
    },
    path,
  );
}

function parseSetView(value: unknown, path: string): SetView {
  return requireFields(
    {
      id: readString(value, 'id'),
      tcgdexId: readString(value, 'tcgdexId'),
      nameEn: readString(value, 'nameEn'),
      nameFr: readNullableString(value, 'nameFr'),
      abbreviationOfficial: readNullableString(value, 'abbreviationOfficial'),
    },
    path,
  );
}

function parseVariantView(value: unknown, path: string): VariantView | null {
  if (value === null) {
    return null;
  }
  return requireFields(
    {
      id: readString(value, 'id'),
      type: readString(value, 'type'),
      subtype: readNullableString(value, 'subtype'),
      size: readString(value, 'size'),
      stamps: readStringArray(value, 'stamps'),
      foil: readNullableString(value, 'foil'),
    },
    path,
  );
}

function parseCardEntryView(value: unknown, path: string): CardEntryView {
  return {
    ...parseCardEntry(value, path),
    card: parseCardView(readField(value, 'card'), path),
    set: parseSetView(readField(value, 'set'), path),
    variant: parseVariantView(readField(value, 'variant'), path),
  };
}

function parseList<T>(value: unknown, path: string, parseItem: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) {
    throw unexpectedResponse(path);
  }
  return value.map(parseItem);
}

function parseCardsPage(value: unknown, path: string): CollectionCardsPage {
  const page = requireFields(
    {
      total: readNumber(value, 'total'),
      page: readNumber(value, 'page'),
      pageSize: readNumber(value, 'pageSize'),
    },
    path,
  );
  const items = parseList(readField(value, 'items'), path, (item) =>
    parseCardEntryView(item, path),
  );
  return { items, ...page };
}

/**
 * Crée le service des collections.
 * @param options - Client API de l'application
 * @returns Le service, sans état : le cache est celui de TanStack Query
 */
export function createCollectionService({ client }: CollectionServiceOptions): CollectionService {
  return {
    async list() {
      const path = '/collections';
      return parseList(await client.request(path), path, (item) => parseCollection(item, path));
    },

    async listCards(collectionId, page) {
      const path: ApiPath = `${collectionPath(collectionId)}/cards`;
      // Deux nombres : rien à encoder (shared compile sans URLSearchParams, type du DOM).
      const query = `page=${page}&pageSize=${COLLECTION_CARDS_PAGE_SIZE}`;
      return parseCardsPage(await client.request(`${path}?${query}`), path);
    },

    async addCard(collectionId, { cardId, variantId, quantity, condition, language }) {
      const path: ApiPath = `${collectionPath(collectionId)}/cards`;
      const body = await client.request(path, {
        method: 'POST',
        body: {
          cardId,
          ...(variantId !== undefined && { variantId }),
          quantity,
          condition,
          language,
        },
      });
      return parseCardEntry(body, path);
    },
  };
}
