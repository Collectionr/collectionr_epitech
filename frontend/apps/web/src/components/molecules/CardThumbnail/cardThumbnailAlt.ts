import type { CardView, SetView } from '@shared/types';

/**
 * Texte alternatif : nom, set et numéro (« Dracaufeu — Set de Base 4 »). Le nombre de cartes du
 * set (« 4/102 ») n'est pas fourni par l'API.
 */
export function cardThumbnailAlt(
  card: Pick<CardView, 'nameFr' | 'nameEn' | 'number'>,
  set: Pick<SetView, 'nameFr' | 'nameEn'>,
): string {
  return `${card.nameFr ?? card.nameEn} — ${set.nameFr ?? set.nameEn} ${card.number}`;
}
