> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-11-25
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
| Session (statut, utilisateur, jeton d'acces) | Zustand (`authStore`, lu via `useAuth`) | Acces global, en memoire ; seul le jeton de renouvellement est persiste, a part (voir Stockage des jetons) |

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

**authStore** -- Session utilisateur (`packages/shared/src/stores/authStore.ts`, livre en COLLR-699). Store "vanilla" cree par `createAuthStore()` : une instance par application, et par test. Rien n'est persiste par ce store : le jeton d'acces reste en memoire, le jeton de renouvellement est confie a un `TokenStorage` fourni par l'application (voir Stockage des jetons).

| Etat | Type | Description |
|---|---|---|
| `status` | `'unknown' \| 'authenticated' \| 'anonymous'` | `unknown` jusqu'a ce que la restauration au demarrage aboutisse |
| `user` | `User \| null` | Utilisateur connecte |
| `accessToken` | `string \| null` | Jeton d'acces, en memoire uniquement |
| `endReason` | `'expired' \| 'logout' \| null` | Raison de la derniere fermeture : expiration en cours d'usage (renouvellement refuse) ou deconnexion volontaire, jusqu'a l'arrivee sur la connexion |
| `restoreError` | `unknown` | Erreur de la derniere restauration (serveur injoignable...) ; le statut reste alors `unknown` |

Le store n'est jamais modifie par un composant : seul `authService` (`packages/shared/src/services/authService.ts`) l'alimente. Les composants lisent la session par les hooks de `@shared/hooks`, fournis par `AuthServiceContext` a la racine de l'app :

| Hook | Role |
|---|---|
| `useAuth()` | `status`, `user`, `endReason`, `restoreError` |
| `useRestoreSession()` | Lance la restauration au montage (une fois par chargement) ; renvoie la fonction « Reessayer » |
| `useSessionExpiredNotice()` | Sur la connexion : `true` si la session vient d'expirer ; acquitte la raison de fermeture |
| `useLogin()` | Mutation : connexion, session ouverte, profil mis en cache (`QUERY_KEYS.me`) |
| `useRegister()` | Mutation : inscription, sans ouverture de session (le back ne renvoie pas de jetons) |
| `useLogout()` | Mutation : session fermee, puis revocation du jeton, cache vide (`queryClient.clear()`), meme si le back est injoignable |
| `useMe()` | Requete `GET /users/me`, active en session, initialisee avec l'utilisateur de la session |

Les redirections (page demandee apres connexion, `/connexion` apres deconnexion) restent dans l'application : les hooks ne dependent d'aucun routeur, pour servir aussi au mobile. Les erreurs de connexion et d'inscription sont traduites par `translateAuthError` (`@shared/utils`), et les formulaires valides par `@shared/validation` (`validateEmail`, `validateNewPassword`, `validateUsername`...).

Generation de session : chaque fermeture (deconnexion, renouvellement refuse) incremente une generation. Une reponse de refresh, de connexion ou de restauration n'ecrit ni jeton ni statut si la generation a change depuis son envoi : un refresh qui arrive apres une deconnexion, reussie ou non, ne reconnecte jamais. La deconnexion ferme la session localement avant de revoquer le jeton aupres du back.

Renouvellement (`authService.refresh`) : un seul a la fois, sous un verrou partage par les onglets (Web Locks, fourni par l'app web), avec le jeton relu dans le stockage juste avant l'appel. Le jeton etant a usage unique, deux onglets qui le presenteraient en meme temps feraient revoquer toute la chaine de connexion. Restauration (`authService.restoreSession`) : renouvellement puis `GET /users/me`, une seule fois par chargement une fois aboutie (double montage du `StrictMode` compris).

| Resultat | Statut | Jeton de renouvellement |
|---|---|---|
| Renouvellement et profil acceptes | `authenticated` | Remplace par le nouveau |
| Aucun jeton, jeton refuse (400, 401), profil refuse (401, 404) | `anonymous` | Supprime |
| Serveur injoignable, delai depasse, 5xx, 429, reponse illisible | `unknown` + `restoreError` : ecran d'erreur avec « Reessayer » (COLLR-700) | Conserve |

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

Un service est une collection de fonctions qui encapsulent les appels HTTP. Il ne gere pas le cache. `apiClient.request` renvoie un corps non valide (`unknown`) : le service en verifie la forme avant de le renvoyer type, et leve une erreur si le contrat de l'API n'est pas respecte.

```typescript
// packages/shared/src/services/authService.ts (extrait)

function parseUser(value: unknown, path: string): User {
  const id = readString(value, 'id');
  const email = readString(value, 'email');
  // ...
  if (id === undefined || email === undefined /* ... */) {
    throw new TypeError(`Reponse inattendue de ${path}`);
  }
  return { id, email, username, createdAt };
}

export function createAuthService({ client, storage, store }: AuthServiceOptions): AuthService {
  return {
    async me() {
      return parseUser(await client.request('/users/me'), '/users/me');
    },
    async register(input) {
      const body = await client.request('/auth/register', { method: 'POST', body: input });
      return parseUser(body, '/auth/register');
    },
    // ...
  };
}
```

### Client HTTP

Le client vit dans `packages/shared/src/services/apiClient.ts`. Il ne lit aucune variable d'environnement : chaque application l'assemble dans son `config/api.ts` et lui fournit l'URL de base, `fetch` et un controleur d'annulation (`new AbortController()`, disponible sur web et mobile). Ces deux derniers sont injectes parce que `packages/shared` compile sans les types DOM.

```typescript
// apps/web/src/config/api.ts
export const apiClient = createApiClient({
  baseUrl: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL), // /api/v1 par defaut
  fetch,
  createAbortController: () => new AbortController(),
  session: createAuthSession(authStore, () => authService), // jeton d'acces, renouvellement
});

const card = await apiClient.request('/cards/swsh3-136'); // unknown : le service valide la forme
await apiClient.request('/collections', { method: 'POST', body: { name: 'Base' } });
```

Comportement commun a toutes les requetes :

| Situation | Comportement |
|---|---|
| Session ouverte | En-tete `Authorization: Bearer <jeton d'acces>` |
| 401 sur une requete authentifiee | Un seul renouvellement (`session.refresh()`), partage par les requetes simultanees, puis la requete est rejouee une fois |
| Renouvellement refuse | `session.clear()` vide la session, la requete leve l'`ApiError` 401 |
| Renouvellement impossible (reseau) | La session est conservee, la requete leve la `NetworkError` |
| 401 d'une route `/auth/*` | Aucun renouvellement : identifiants invalides ou jeton de renouvellement refuse |
| Statut hors 200-299 | `ApiError { status, code, message, fieldErrors?, retryAfterSeconds?, body }` |
| Serveur injoignable, coupure | `NetworkError` de cause `connection` |
| Pas de reponse en 15 s | Requete annulee, `NetworkError` de cause `timeout` |

`code` et `message` viennent du format d'erreur du back (`{ statusCode, error, message, timestamp, path }`) : `code` reprend `error` (ex. : `Conflict`), ou vaut `HTTP_<statut>` si le corps est inexploitable. Le back n'envoie pas encore d'erreurs par champ : `fieldErrors` reste vide. `retryAfterSeconds` est lu dans l'en-tete `Retry-After` (429). Les messages du back sont en anglais et ne s'affichent jamais tels quels : ils sont traduits en francais avant affichage.

`VITE_API_BASE_URL` (web) est verifiee au demarrage : un chemin du meme domaine (`/api/v1`, defaut derriere l'Ingress) ou une URL absolue en http(s). Toute autre valeur bloque le demarrage avec un message explicite.

### Stockage des jetons (decision PO du 25/11/2026)

Le back renvoie le jeton d'acces et le jeton de renouvellement dans le corps des reponses (`POST /auth/login`, `POST /auth/refresh`), sans cookie httpOnly. Le jeton de renouvellement est a usage unique : le reutiliser revoque toute la chaine de connexion.

| Jeton | Stockage | Raison |
|---|---|---|
| Acces (courte duree) | Memoire uniquement, jamais `localStorage` | Jamais persiste : perdu au rechargement, il est renouvele au demarrage |
| Renouvellement | `localStorage` (web) pour l'Alpha | Necessaire pour restaurer la session au demarrage |

Si `localStorage` est inaccessible ou refuse une ecriture (stockage plein ou bloque), l'onglet garde le jeton de renouvellement en memoire jusqu'a la fin de la visite (`apps/web/src/config/tokenStorage.ts`) : la valeur persistee, perimee, est supprimee si possible et n'est plus jamais relue, car presenter un jeton deja utilise ferait revoquer toute la chaine de connexion. La connexion est alors redemandee au prochain chargement.

Risque accepte pour l'Alpha : un script injecte (XSS) peut lire le jeton de renouvellement dans `localStorage`. La cible reste un cookie httpOnly pose par le back. Le mobile utilisera un stockage securise (Keychain / Keystore), d'ou une interface de stockage asynchrone cote `packages/shared`.

### Template : Hook TanStack Query

```typescript
// packages/shared/src/hooks/useCollections.ts

import { useQuery } from '@tanstack/react-query';

import { catalogService, collectionService } from '@shared/services';
import { QUERY_KEYS } from '@shared/constants';

/** Recupere les collections de l'utilisateur. */
export function useCollections() {
  return useQuery({
    queryKey: QUERY_KEYS.collections,
    queryFn: () => collectionService.getAll(),
  });
}

/** Recupere le detail d'une collection par son ID. */
export function useCollection(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.collection(id),
    queryFn: () => collectionService.getById(id),
    enabled: id !== '',
  });
}

/** Recherche dans le catalogue. Active uniquement quand la recherche fait 2+ caracteres. */
export function useSearchCatalog(query: string) {
  return useQuery({
    queryKey: QUERY_KEYS.catalog(query),
    queryFn: () => catalogService.search(query),
    enabled: query.length >= 2,
  });
}
```

### Template : Hook de mutation

```typescript
// packages/shared/src/hooks/useAddToCollection.ts

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { collectionService } from '@shared/services';
import { QUERY_KEYS } from '@shared/constants';

/** Ajoute une carte a une collection de l'utilisateur. */
export function useAddToCollection(collectionId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: collectionService.addCard,
    onSuccess: () => {
      // Detail et cartes de la collection, par prefixe de cle.
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.collection(collectionId) });
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

Apres une mutation reussie, les donnees en cache peuvent etre obsoletes. L'invalidation force un refetch. Les cles sont hierarchiques : une invalidation touche aussi toutes les cles qui commencent par la cle donnee.

| Mutation | Caches a invalider |
|---|---|
| Ajouter une carte a une collection | `QUERY_KEYS.collection(id)` (detail et cartes), `QUERY_KEYS.collections` si la liste affiche des totaux |
| Retirer une carte d'une collection | Idem |
| Modifier la quantite/etat d'une carte | `QUERY_KEYS.cards(id)` (sans filtre : toutes les listes filtrees de la collection) |
| Scan reussi | `QUERY_KEYS.collections` (si ajout automatique) |
| Deconnexion | Tout le cache (`queryClient.clear()`) |

Les cles de requete sont centralisees dans `packages/shared/src/constants/queryKeys.ts`. Aucune cle n'est ecrite a la main dans un hook :

```typescript
import { QUERY_KEYS } from '@shared/constants';

QUERY_KEYS.me;                          // ['me']
QUERY_KEYS.collections;                 // ['collections']
QUERY_KEYS.collection(id);              // ['collections', id]
QUERY_KEYS.cards(id, { rarity: 'Rare' }); // ['collections', id, 'cards', { rarity: 'Rare' }]
QUERY_KEYS.catalog(query);              // ['catalog', query]
```

### Temps de stale (staleTime) et relances

Le `staleTime` determine combien de temps TanStack Query considere les donnees comme fraiches avant de refetch. Le cache est cree une seule fois par `createQueryClient()` (`packages/shared/src/services/queryClient.ts`) et fourni a la racine de l'app web par `QueryClientProvider` (`apps/web/src/App.tsx`).

| Option | Valeur par defaut | Constante |
|---|---|---|
| `staleTime` | 5 min | `DEFAULT_STALE_TIME_MS` |
| `gcTime` | 30 min | `DEFAULT_GC_TIME_MS` |
| `refetchOnWindowFocus` | desactive | -- |

Un hook peut s'ecarter du defaut quand la donnee le justifie (valeurs recommandees) :

| Type de donnee | staleTime | gcTime | Justification |
|---|---|---|---|
| Prix de cartes (marche) | 5 min | 30 min | Les prix du marche evoluent frequemment |
| Collection utilisateur | 2 min | 15 min | L'utilisateur peut modifier sa collection depuis un autre appareil |
| Catalogue cartes (metadata) | 1 h | 2 h | Les metadonnees des cartes changent rarement |
| Resultats de recherche | 2 min | 10 min | Sensibles aux changements de catalogue |
| Detail d'une carte | 30 min | 1 h | Donnees stables |

Relances automatiques (`shouldRetryQuery`) :

| Erreur | Requete (`useQuery`) | Mutation (`useMutation`) |
|---|---|---|
| `NetworkError` (serveur injoignable, delai depasse) | 2 relances maximum | Aucune |
| `ApiError` 5xx | 2 relances maximum | Aucune |
| `ApiError` 4xx | Aucune : relancer ne change rien | Aucune |
| Autre erreur (bug) | Aucune | Aucune |

Une mutation n'est jamais relancee automatiquement : rejouer une connexion ou un ajout n'est pas sans effet (tentative comptee par la limite de debit, doublon).

Chaque route est protegee par `RouteErrorBoundary` (`apps/web/src/router/`) : une erreur de rendu, de chargement de la page ou d'une requete en `throwOnError` affiche un ecran d'erreur avec « Reessayer », jamais un ecran blanc. « Reessayer » relance les requetes en erreur puis rend la route a nouveau ; si c'est l'import de la page qui a echoue (fichier introuvable apres un nouveau deploiement, reseau coupe), il recharge la page, React gardant en memoire l'echec d'un `lazy()`.

Les devtools TanStack Query sont chargees a la demande sous `npm run dev` uniquement, absentes du build de production.

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
