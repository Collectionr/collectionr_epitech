import { useMutation, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '../constants/queryKeys';
import type { AddCardEntryInput, CardEntry, CardEntryView } from '../types';
import { useCollectionService } from './collectionServiceContext';
import type { CollectionCardsData } from './useCollectionCards';

/** Ajout d'une carte à une collection. */
export interface AddCardEntryVariables {
  /** Collection de destination */
  collectionId: string;
  /** Carte, quantité, état et langue envoyés à l'API */
  entry: AddCardEntryInput;
  /**
   * Carte choisie dans le catalogue, affichée dans la collection avant la réponse de l'API (qui ne
   * renvoie pas les données du catalogue).
   */
  preview: Pick<CardEntryView, 'card' | 'set' | 'variant'>;
}

/** Ligne affichée en attendant la réponse, retrouvée par son identifiant provisoire. */
interface AddCardEntryContext {
  optimisticId: string;
}

/** Préfixe des identifiants provisoires : jamais un UUID de l'API. */
export const OPTIMISTIC_ENTRY_ID_PREFIX = 'optimistic-';

let optimisticSequence = 0;

/** Remplace les lignes qui répondent au critère, page par page. */
function mapEntries(
  data: CollectionCardsData,
  map: (entry: CardEntryView) => CardEntryView | null,
): CollectionCardsData {
  let removed = 0;
  const pages = data.pages.map((page) => {
    const items = page.items.flatMap((entry) => {
      const mapped = map(entry);
      if (mapped === null) {
        removed += 1;
        return [];
      }
      return [mapped];
    });
    return { ...page, items };
  });
  return {
    ...data,
    pages: pages.map((page) => ({ ...page, total: page.total - removed })),
  };
}

/** Ajoute la ligne en tête de la première page ; le total de chaque page en tient compte. */
function prependEntry(data: CollectionCardsData, entry: CardEntryView): CollectionCardsData {
  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: index === 0 ? [entry, ...page.items] : page.items,
      total: page.total + 1,
    })),
  };
}

/**
 * Ajoute une carte à une collection (`POST /collections/:id/cards`), en optimiste : la ligne
 * apparaît tout de suite en tête des cartes de la collection en cache, puis prend l'identifiant
 * renvoyé par l'API. Si l'API refuse, seule cette ligne est retirée (un autre ajout en cours est
 * gardé). Une fois la réponse reçue, la collection et ses cartes sont invalidées, et elles seules.
 * Chaque ajout crée une nouvelle ligne, comme le back : jamais de fusion avec une ligne existante.
 */
export function useAddCardEntry() {
  const collectionService = useCollectionService();
  const queryClient = useQueryClient();

  return useMutation<CardEntry, Error, AddCardEntryVariables, AddCardEntryContext>({
    mutationFn: ({ collectionId, entry }) => collectionService.addCard(collectionId, entry),

    onMutate: async ({ collectionId, entry, preview }) => {
      const cardsKey = QUERY_KEYS.cards(collectionId);
      // Une liste en cours de chargement écraserait la ligne ajoutée.
      await queryClient.cancelQueries({ queryKey: cardsKey });

      optimisticSequence += 1;
      const optimisticId = `${OPTIMISTIC_ENTRY_ID_PREFIX}${optimisticSequence}`;
      const now = new Date().toISOString();
      const optimisticEntry: CardEntryView = {
        id: optimisticId,
        collectionId,
        cardId: entry.cardId,
        variantId: entry.variantId ?? null,
        quantity: entry.quantity,
        condition: entry.condition,
        language: entry.language,
        gradingNote: null,
        notes: null,
        addedAt: now,
        updatedAt: now,
        ...preview,
      };
      queryClient.setQueriesData<CollectionCardsData>(
        { queryKey: cardsKey },
        (data) => data && prependEntry(data, optimisticEntry),
      );
      return { optimisticId };
    },

    onSuccess: (created, { collectionId }, context) => {
      queryClient.setQueriesData<CollectionCardsData>(
        { queryKey: QUERY_KEYS.cards(collectionId) },
        (data) =>
          data &&
          mapEntries(data, (entry) =>
            entry.id === context.optimisticId ? { ...entry, ...created } : entry,
          ),
      );
    },

    onError: (_error, { collectionId }, context) => {
      if (context === undefined) {
        return;
      }
      queryClient.setQueriesData<CollectionCardsData>(
        { queryKey: QUERY_KEYS.cards(collectionId) },
        (data) =>
          data && mapEntries(data, (entry) => (entry.id === context.optimisticId ? null : entry)),
      );
    },

    onSettled: (_created, _error, { collectionId }) =>
      // Détail et cartes de cette collection seulement (préfixe de clé), jamais tout le cache.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection(collectionId) }),
  });
}
