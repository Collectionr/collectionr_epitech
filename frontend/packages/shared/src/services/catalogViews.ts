import type { CardView, SetView, VariantView } from '../types';
import { readNullableString, readString, readStringArray, requireFields } from './responseReaders';

/**
 * Lecture des vues du catalogue (`CardViewDto`, `SetViewDto`, `VariantViewDto`), communes aux
 * cartes d'une collection et aux résultats de recherche.
 */

/**
 * Carte du catalogue.
 * @throws {TypeError} Si la forme n'est pas celle du `CardViewDto`
 */
export function parseCardView(value: unknown, path: string): CardView {
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

/**
 * Set d'une carte.
 * @throws {TypeError} Si la forme n'est pas celle du `SetViewDto`
 */
export function parseSetView(value: unknown, path: string): SetView {
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

/**
 * Impression d'une carte.
 * @throws {TypeError} Si la forme n'est pas celle du `VariantViewDto`
 */
export function parseVariantView(value: unknown, path: string): VariantView {
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
