import type { CardEntryView, Collection } from '@shared/types';

import { findMockCard, MOCK_LICENCE_ID } from './catalogue';

/** Collections simulées et leurs lignes, modifiables le temps d'une session de dev ou d'un test. */
export interface MockCollectionStore {
  collections: Collection[];
  /** Lignes par collection, les plus récentes d'abord */
  entries: Map<string, CardEntryView[]>;
}

const CLASSEUR_BASE: Collection = {
  id: '5d18e9d4-f2fc-4bee-8b9f-1c6bd24aa434',
  licenceTCGId: MOCK_LICENCE_ID,
  name: 'Classeur Base',
  createdAt: '2026-11-20T10:00:00.000Z',
  updatedAt: '2026-11-20T10:00:00.000Z',
};

const DOUBLES: Collection = {
  id: '4b1c5382-d4e8-4dc4-94d8-8de6c71ebb63',
  licenceTCGId: MOCK_LICENCE_ID,
  name: 'Doubles à échanger',
  createdAt: '2026-11-22T18:30:00.000Z',
  updatedAt: '2026-11-22T18:30:00.000Z',
};

interface EntrySeed {
  id: string;
  collectionId: string;
  cardId: string;
  quantity: number;
  condition: CardEntryView['condition'];
  language: CardEntryView['language'];
  addedAt: string;
}

function toEntryView({ cardId, addedAt, ...seed }: EntrySeed): CardEntryView {
  const catalogueCard = findMockCard(cardId);
  if (catalogueCard === undefined) {
    throw new Error(`Carte absente du catalogue simulé : ${cardId}`);
  }
  const [variant = null] = catalogueCard.variants;
  return {
    ...seed,
    cardId,
    variantId: variant?.id ?? null,
    gradingNote: null,
    notes: null,
    addedAt,
    updatedAt: addedAt,
    card: catalogueCard.card,
    set: catalogueCard.set,
    variant,
  };
}

/** Lignes de départ, les plus récentes d'abord. */
const ENTRY_SEEDS: EntrySeed[] = [
  {
    id: '89a7900b-84fe-4393-8e16-884503ebfce9',
    collectionId: CLASSEUR_BASE.id,
    cardId: 'ad028ab5-1133-4ae7-92be-8ab2e1e00b9c',
    quantity: 3,
    condition: 'NM',
    language: 'fr',
    addedAt: '2026-11-21T09:15:00.000Z',
  },
  {
    id: 'd200a752-ef95-46b9-aa94-1c8bf89cdf20',
    collectionId: CLASSEUR_BASE.id,
    cardId: '617559c7-285c-4ce4-9f75-3dd33ad96222',
    quantity: 1,
    condition: 'LP',
    language: 'en',
    addedAt: '2026-11-20T11:40:00.000Z',
  },
];

/**
 * Crée un jeu de collections simulées neuf : deux collections, dont l'une contient déjà deux
 * cartes. Chaque appel repart de zéro (un test ne voit pas les ajouts d'un autre).
 */
export function createMockCollectionStore(): MockCollectionStore {
  const entries = new Map<string, CardEntryView[]>([
    [CLASSEUR_BASE.id, []],
    [DOUBLES.id, []],
  ]);
  for (const seed of ENTRY_SEEDS) {
    entries.get(seed.collectionId)?.push(toEntryView(seed));
  }
  return { collections: [CLASSEUR_BASE, DOUBLES], entries };
}
