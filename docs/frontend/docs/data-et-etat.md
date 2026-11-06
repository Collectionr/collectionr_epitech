> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Data et Etat -- CollectionR

La gestion des donnees et de l'etat sont les deux faces d'une meme piece. D'un cote, les donnees provenant du backend (cartes, collection, prix) gerees par TanStack Query. De l'autre, l'etat purement client (filtres, theme, session) gere par Zustand. Ce document explique comment choisir entre ces outils et comment les utiliser correctement.

Le piege le plus courant est de dupliquer les donnees serveur dans un store Zustand. Cela cree de la desynchronisation et des bugs difficiles a tracer. Ce document pose les regles pour eviter ce piege.

---

## 1. Regle de decision -- quelle solution pour quelle donnee

Trois outils coexistent dans le projet. Le choix depend de la nature de la donnee, pas du composant qui l'utilise.

| Situation | Solution | Pourquoi |
|---|---|---|
| Donnee locale a un seul composant (champ ouvert/ferme, valeur d'input) | `useState` | Pas besoin de partager, pas besoin de persister |
| Donnee serveur (cartes, prix, collection) | TanStack Query | Cache automatique, deduplication, etats loading/error/refetch |
| Donnee globale UI (modal ouverte, toast, filtre actif) | Zustand | Partagee entre composants, pas de source serveur |
| Session utilisateur, auth token | Zustand (`useAuthStore`) | Persiste entre sessions, necessite un acces global |

### Schema de decision

```
La donnee vient du backend ?
  |
  |-- OUI --> TanStack Query (useQuery, useMutation)
  |
  |-- NON --> La donnee est utilisee par un seul composant ?
                |
                |-- OUI --> useState local
                |
                |-- NON --> Zustand store
```

### Regle fondamentale

Ne jamais dupliquer du server state dans Zustand. Si une donnee vient du backend, elle est geree exclusivement par TanStack Query. Zustand ne stocke que de l'etat purement client.

---

## 2. Gestion d'etat avec Zustand

### Convention de structure d'un store

Chaque store Zustand suit la meme structure : etat, actions, et les selectors sont des fonctions pures exportees separement. Cette convention rend les stores previsibles et testables.

```typescript
// stores/collectionStore.ts

import { create } from 'zustand';

// -- Types --------------------------------------------------------

type SortOrder = 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'date-added';

interface CollectionState {
  // Etat
  selectedCardIds: string[];
  sortOrder: SortOrder;
  isMultiSelectMode: boolean;

  // Actions
  toggleCardSelection: (cardId: string) => void;
  clearSelection: () => void;
  setSortOrder: (order: SortOrder) => void;
  setMultiSelectMode: (enabled: boolean) => void;
}

// -- Store --------------------------------------------------------

export const useCollectionStore = create<CollectionState>((set) => ({
  // Etat initial
  selectedCardIds: [],
  sortOrder: 'date-added',
  isMultiSelectMode: false,

  // Actions
  toggleCardSelection: (cardId) =>
    set((state) => ({
      selectedCardIds: state.selectedCardIds.includes(cardId)
        ? state.selectedCardIds.filter((id) => id !== cardId)
        : [...state.selectedCardIds, cardId],
    })),

  clearSelection: () =>
    set({ selectedCardIds: [], isMultiSelectMode: false }),

  setSortOrder: (sortOrder) => set({ sortOrder }),

  setMultiSelectMode: (isMultiSelectMode) => set({ isMultiSelectMode }),
}));

// -- Selectors ----------------------------------------------------

/** Nombre de cartes selectionnees. */
export const selectSelectedCount = (state: CollectionState) =>
  state.selectedCardIds.length;

/** Verifie si une carte specifique est selectionnee. */
export const selectIsCardSelected = (cardId: string) =>
  (state: CollectionState) => state.selectedCardIds.includes(cardId);
```

### Les 5 stores prevus

Chaque store a une responsabilite unique. Pas de store "fourre-tout".

**useCollectionStore** -- Etat local de la vue collection : selection, tri, mode multi-selection. Ne stocke PAS les cartes elles-memes (c'est TanStack Query qui les gere).

| Etat | Type | Description |
|---|---|---|
| `selectedCardIds` | `string[]` | IDs des cartes selectionnees (mode multi-selection) |
| `sortOrder` | `SortOrder` | Ordre de tri actif |
| `isMultiSelectMode` | `boolean` | Mode multi-selection active |

**useCartStore** -- Selection en cours lors de l'ajout d'une carte (manuellement ou par scan). Sert de tampon entre le scan/recherche et l'ajout final a la collection.

| Etat | Type | Description |
|---|---|---|
| `pendingCard` | `Card \| null` | Carte en attente d'ajout (resultat de scan ou recherche) |
| `condition` | `CardCondition` | Etat physique selectionne pour la carte |
| `quantity` | `number` | Quantite a ajouter |

```typescript
// stores/cartStore.ts

import { create } from 'zustand';
import type { Card, CardCondition } from '@/types';

interface CartState {
  pendingCard: Card | null;
  condition: CardCondition;
  quantity: number;

  setPendingCard: (card: Card | null) => void;
  setCondition: (condition: CardCondition) => void;
  setQuantity: (quantity: number) => void;
  reset: () => void;
}

export const useCartStore = create<CartState>((set) => ({
  pendingCard: null,
  condition: 'NM',
  quantity: 1,

  setPendingCard: (pendingCard) => set({ pendingCard }),
  setCondition: (condition) => set({ condition }),
  setQuantity: (quantity) => set({ quantity }),
  reset: () => set({ pendingCard: null, condition: 'NM', quantity: 1 }),
}));
```

**useAuthStore** -- Session utilisateur. Persiste le token entre les redemarrages via AsyncStorage (mobile) ou localStorage (web).

| Etat | Type | Description |
|---|---|---|
| `token` | `string \| null` | JWT d'acces |
| `refreshToken` | `string \| null` | Token de rafraichissement |
| `user` | `User \| null` | Donnees utilisateur en cache |
| `isAuthenticated` | `boolean` | Derive : `token !== null` |

```typescript
// stores/authStore.ts

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '@/types';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;

  setAuth: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),

      logout: () =>
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

**useUIStore** -- Etat de l'interface : theme, modals, toasts, chargement global.

| Etat | Type | Description |
|---|---|---|
| `theme` | `'light' \| 'dark'` | Theme actif |
| `activeModal` | `string \| null` | ID du modal actuellement ouvert |
| `toasts` | `Toast[]` | File de notifications toast |
| `isGlobalLoading` | `boolean` | Indicateur de chargement global (overlay) |

**useFiltersStore** -- Filtres actifs sur la vue collection et la recherche. Separe de `useCollectionStore` pour pouvoir etre reinitialise independamment.

| Etat | Type | Description |
|---|---|---|
| `rarity` | `CardRarity \| null` | Filtre par rarete |
| `set` | `string \| null` | Filtre par edition/set |
| `type` | `string \| null` | Filtre par type (Feu, Eau, etc.) |
| `condition` | `CardCondition \| null` | Filtre par etat physique |
| `priceRange` | `[number, number] \| null` | Filtre par fourchette de prix |

```typescript
// stores/filtersStore.ts

import { create } from 'zustand';
import type { CardRarity, CardCondition } from '@/types';

interface FiltersState {
  rarity: CardRarity | null;
  set: string | null;
  type: string | null;
  condition: CardCondition | null;
  priceRange: [number, number] | null;

  setFilter: (key: keyof Omit<FiltersState, 'setFilter' | 'resetFilters'>, value: unknown) => void;
  resetFilters: () => void;
}

const INITIAL_FILTERS = {
  rarity: null,
  set: null,
  type: null,
  condition: null,
  priceRange: null,
};

export const useFiltersStore = create<FiltersState>((set) => ({
  ...INITIAL_FILTERS,

  setFilter: (key, value) => set({ [key]: value }),
  resetFilters: () => set(INITIAL_FILTERS),
}));
```

### Regle d'acces aux stores

Ne jamais importer un store directement dans un composant template ou page. Toujours passer par un hook intermediaire qui encapsule la logique. Cette regle existe pour decoupler les composants du store. Si la structure du store change, seul le hook intermediaire doit etre modifie.

```typescript
// INTERDIT : import direct du store dans une page
function CollectionPage() {
  const selectedCardIds = useCollectionStore((s) => s.selectedCardIds);
  const sortOrder = useCollectionStore((s) => s.sortOrder);
  const cards = useQuery(...);
  const sortedCards = useMemo(() => sortCards(cards, sortOrder), [cards, sortOrder]);
  // ...
}

// CORRECT : hook intermediaire
function useCollectionView() {
  const { data: collection, isLoading } = useCollection();
  const sortOrder = useCollectionStore((s) => s.sortOrder);
  const selectedCardIds = useCollectionStore((s) => s.selectedCardIds);

  const sortedItems = useMemo(
    () => sortCards(collection?.items ?? [], sortOrder),
    [collection?.items, sortOrder]
  );

  return { items: sortedItems, isLoading, selectedCardIds };
}

// Utilisation dans la page
function CollectionPage() {
  const { items, isLoading, selectedCardIds } = useCollectionView();
  // ...
}
```

Toujours utiliser un selector pour extraire uniquement la donnee necessaire. Utiliser le store entier provoque des re-renders inutiles.

```typescript
// BON : selector specifique, re-render uniquement quand theme change
const theme = useUIStore((state) => state.theme);

// MAUVAIS : tout le store, re-render a chaque changement de n'importe quel champ
const store = useUIStore();
```

---

## 3. Data fetching avec TanStack Query

### Architecture

Les appels API suivent un flux en 3 couches. Chaque couche a une responsabilite unique.

```
Composant (UI)
    |
    | utilise un hook
    v
Hook (useCards, useCollection)          -- TanStack Query (cache, loading, error)
    |
    | appelle une fonction du service
    v
Service API (cardService.ts)            -- Couche HTTP pure (fetch, headers, serialisation)
    |
    | HTTP REST
    v
Backend (NestJS + Fastify)
```

Les composants ne font jamais fetch directement. Un composant qui appelle un service ou `fetch` directement ne peut pas beneficier du cache TanStack Query, de la deduplication des requetes, ni de la gestion automatique des etats loading/error.

### Convention de nommage des hooks

| Pattern | Utilisation | Exemple |
|---|---|---|
| `useEntites` (pluriel) | Liste paginee ou complete | `useCards`, `useCollectionItems` |
| `useEntite(id)` (singulier) | Detail d'une entite | `useCard(id)`, `useMarketPrice(cardId)` |
| `useSearchEntite(query)` | Recherche | `useSearchCards(query)` |
| `useCreateEntite` | Mutation de creation | `useCreateCard` |
| `useUpdateEntite` | Mutation de mise a jour | `useUpdateCard` |
| `useDeleteEntite` | Mutation de suppression | `useDeleteCard`, `useRemoveFromCollection` |

### Template : Service API

Un service est une collection de fonctions pures qui encapsulent les appels HTTP. Il ne gere ni le cache ni l'etat.

```typescript
// services/cardService.ts

import { apiClient } from './apiClient';
import type { Card, PaginatedResponse } from '@/types';

interface GetCardsParams {
  page?: number;
  limit?: number;
  set?: string;
}

/** Service d'acces aux endpoints cartes. */
export const cardService = {
  /** Recupere une liste paginee de cartes. */
  getAll: (params: GetCardsParams = {}) =>
    apiClient.get<PaginatedResponse<Card>>('/cards', {
      params: { page: params.page ?? 1, limit: params.limit ?? 50, set: params.set },
    }),

  /** Recupere le detail d'une carte par son ID. */
  getById: (id: string) =>
    apiClient.get<Card>(`/cards/${id}`),

  /** Recherche des cartes par nom. */
  search: (query: string) =>
    apiClient.get<Card[]>('/cards/search', { params: { q: query } }),
};
```

### Template : Client HTTP

```typescript
// services/apiClient.ts

import { useAuthStore } from '@/stores';
import { API_BASE_URL } from '@/constants';

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async get<T>(path: string, options?: { params?: Record<string, unknown> }): Promise<T> {
    const url = new URL(path, this.baseUrl);
    if (options?.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return this.request<T>('GET', url.toString());
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', `${this.baseUrl}${path}`, body);
  }

  async delete<T>(path: string): Promise<T> {
    return this.request<T>('DELETE', `${this.baseUrl}${path}`);
  }

  private async request<T>(method: string, url: string, body?: unknown): Promise<T> {
    const token = useAuthStore.getState().token;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      ...(body && { body: JSON.stringify(body) }),
    });

    if (response.status === 401) {
      useAuthStore.getState().logout();
      throw new ApiError(401, 'Session expiree');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new ApiError(response.status, error.message ?? 'Erreur serveur');
    }

    return response.json() as Promise<T>;
  }
}

export const apiClient = new ApiClient(API_BASE_URL);

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

### Template : Hook TanStack Query

```typescript
// hooks/useCards.ts

import { useQuery } from '@tanstack/react-query';
import { cardService } from '@/services';
import { QUERY_KEYS } from '@/constants';

/** Recupere la liste paginee des cartes. */
export function useCards(page = 1) {
  return useQuery({
    queryKey: [...QUERY_KEYS.cards.all, page],
    queryFn: () => cardService.getAll({ page }),
  });
}

/** Recupere le detail d'une carte par son ID. */
export function useCard(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.cards.detail(id),
    queryFn: () => cardService.getById(id),
    enabled: !!id,
  });
}

/** Recherche des cartes. Active uniquement quand la query fait 2+ caracteres. */
export function useSearchCards(query: string) {
  return useQuery({
    queryKey: QUERY_KEYS.cards.search(query),
    queryFn: () => cardService.search(query),
    enabled: query.length >= 2,
  });
}
```

### Template : Hook de mutation

```typescript
// hooks/useAddToCollection.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionService } from '@/services';
import { QUERY_KEYS } from '@/constants';

/** Ajoute une carte a la collection de l'utilisateur. */
export function useAddToCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: collectionService.addCard,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.collections.all,
      });
    },
  });
}
```

### Gestion des etats loading / error / empty

Chaque etat retourne par TanStack Query a un rendu correspondant. Ne jamais afficher une page vide.

| Etat | Rendu | Composant |
|---|---|---|
| `isLoading` | Skeleton du composant | `CardPreviewSkeleton`, `CardListSkeleton` |
| `isError` | Message d'erreur avec bouton retry | `ErrorState` (organism) ou toast |
| `data` vide | Etat vide avec illustration | `EmptyState` (molecule) |
| `data` present | Rendu normal | Le composant de donnees |

```typescript
function CardListPage() {
  const { data, isLoading, isError, error, refetch } = useCards();

  if (isLoading) {
    return <CardListSkeleton />;
  }

  if (isError) {
    return (
      <ErrorState
        message={error.message}
        onRetry={refetch}
      />
    );
  }

  if (data.data.length === 0) {
    return <EmptyState message="Aucune carte trouvee" />;
  }

  return <CardList cards={data.data} />;
}
```

### Invalidation de cache apres mutation

Apres une mutation reussie, les donnees en cache peuvent etre obsoletes. L'invalidation force un refetch.

| Mutation | Caches a invalider |
|---|---|
| Ajouter une carte a la collection | `collections.all`, `collections.items(id)` |
| Retirer une carte de la collection | `collections.all`, `collections.items(id)` |
| Modifier la quantite/etat d'une carte | `collections.items(id)` |
| Scan reussi | `collections.all` (si ajout automatique) |

Les query keys sont centralisees dans un fichier unique :

```typescript
// constants/queryKeys.ts

export const QUERY_KEYS = {
  cards: {
    all: ['cards'] as const,
    detail: (id: string) => ['cards', 'detail', id] as const,
    search: (query: string) => ['cards', 'search', query] as const,
    bySet: (setId: string) => ['cards', 'set', setId] as const,
  },
  collections: {
    all: ['collections'] as const,
    detail: (id: string) => ['collections', 'detail', id] as const,
    items: (id: string) => ['collections', 'items', id] as const,
  },
  prices: {
    byCard: (cardId: string) => ['prices', cardId] as const,
  },
} as const;
```

### Temps de stale (staleTime) recommandes

Le `staleTime` determine combien de temps TanStack Query considere les donnees comme fraiches avant de refetch.

| Type de donnee | staleTime | gcTime | Justification |
|---|---|---|---|
| Prix de cartes (marche) | 5 min | 30 min | Les prix du marche evoluent frequemment |
| Collection utilisateur | 2 min | 15 min | L'utilisateur peut modifier sa collection depuis un autre appareil |
| Catalogue cartes (metadata) | 1 h | 2 h | Les metadonnees des cartes changent rarement |
| Resultats de recherche | 2 min | 10 min | Sensibles aux changements de catalogue |
| Detail d'une carte | 30 min | 1 h | Donnees stables |

```typescript
// config/queryClient.ts

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,     // 5 min par defaut
      gcTime: 30 * 60 * 1000,       // 30 min de cache
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});
```

### WebSocket / SSE : notifications de scan

Le scan de carte est un processus asynchrone. Le backend notifie le frontend quand le resultat est pret via Server-Sent Events (SSE).

```typescript
// hooks/useScanEvents.ts

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/constants';
import { API_BASE_URL } from '@/constants';

/**
 * Ecoute les evenements SSE du backend pour les resultats de scan.
 * Met a jour le cache TanStack Query quand un resultat arrive.
 */
export function useScanEvents(scanId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!scanId) return;

    const eventSource = new EventSource(
      `${API_BASE_URL}/scanner/events/${scanId}`
    );

    eventSource.addEventListener('scan-complete', (event) => {
      const result = JSON.parse(event.data);

      // Injecter le resultat directement dans le cache TanStack Query
      queryClient.setQueryData(
        QUERY_KEYS.cards.detail(result.card.id),
        result.card
      );
    });

    eventSource.addEventListener('scan-error', (event) => {
      const error = JSON.parse(event.data);
      // Gerer l'erreur (affichage toast via le composant parent)
    });

    return () => {
      eventSource.close();
    };
  }, [scanId, queryClient]);
}
```

Flux complet du scan avec SSE :

```
1. Mobile envoie l'image      --> POST /scanner/identify --> Retourne { scanId }
2. Mobile ecoute les events    --> SSE /scanner/events/{scanId}
3. Backend traite l'image      --> Microservice Python (FastAPI + OpenCV)
4. Backend emet l'evenement    --> scan-complete { card, confidence }
5. Hook injecte dans le cache  --> queryClient.setQueryData(...)
6. Composant se met a jour     --> Le resultat apparait automatiquement
```

---

## Voir aussi

- [conventions-code.md](./conventions-code.md) -- Regles TypeScript pour les types des stores et services
- [composants.md](./composants.md) -- Skeleton loaders pour les etats de chargement
- [architecture.md](./architecture.md) -- Placement des fichiers stores, hooks et services
- [CONTRIBUTING.md (global)](../../CONTRIBUTING.md) -- Tests des hooks et stores
