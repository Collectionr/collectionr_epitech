> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Conventions de code -- CollectionR

Ce document definit les regles TypeScript, de nommage, d'imports et de gestion d'erreurs. Ces regles existent pour que tout le code du projet se lise comme s'il avait ete ecrit par une seule personne, quel que soit le contributeur.

---

## 1. TypeScript

TypeScript est le seul langage autorise sur le frontend. Le typage strict empeche des categories entieres de bugs avant meme l'execution.

### Mode strict obligatoire

Le compilateur est configure avec `strict: true` dans `tsconfig.json`. Cela active tous les controles de type stricts.

### Interdiction du type `any`

Le type `any` desactive le typage et annule tous les benefices de TypeScript. Il est interdit dans tout le projet.

```typescript
// INTERDIT
function processResponse(data: any) {
  return data.cards;
}

// CORRECT : typage precis
function processResponse(data: PaginatedResponse<Card>): Card[] {
  return data.data;
}

// CORRECT : unknown quand le type est veritablement inconnu
function parseExternalData(raw: unknown): Card {
  if (!isCard(raw)) {
    throw new Error('Format de donnees invalide');
  }
  return raw;
}
```

### Interface vs Type

La distinction est simple : `interface` pour les objets et props, `type` pour les unions et aliases.

```typescript
// interface : objets, props de composants, entites
interface Card {
  /** Identifiant unique de la carte (ex: "swsh3-136") */
  id: string;
  /** Nom affiche de la carte */
  name: string;
  /** Set/edition a laquelle appartient la carte */
  set: CardSet;
  /** Numero de la carte dans le set */
  number: string;
  /** Rarete de la carte */
  rarity: CardRarity;
  /** Types de la carte (Feu, Eau, etc.) */
  types: string[];
  /** Points de vie */
  hp: number;
  /** URL de l'image haute resolution */
  imageUrl: string;
}

// type : unions, aliases, types derives
type CardCondition = 'NM' | 'LP' | 'MP' | 'HP' | 'DMG';
type CardRarity = 'Common' | 'Uncommon' | 'Rare' | 'Rare Holo' | 'Ultra Rare' | 'Secret Rare';
type CardWithPrice = Card & { marketPrice: MarketPrice };

// type : types utilitaires
type PartialCard = Partial<Pick<Card, 'name' | 'set' | 'rarity'>>;
```

### Convention sur les prefixes d'interface

Le projet n'utilise pas le prefixe `I` sur les interfaces. Ce prefixe est une convention C# qui n'a pas sa place en TypeScript moderne.

```typescript
// INTERDIT
interface ICard { ... }
interface ICardProps { ... }

// CORRECT
interface Card { ... }
interface CardPreviewProps { ... }
```

### Exemple d'interface Card complete

```typescript
/**
 * Represente une carte TCG dans le systeme CollectionR.
 * Cette interface est la reference pour toute donnee de carte dans le frontend.
 */
interface Card {
  /** Identifiant unique au format "setId-number" (ex: "swsh3-136") */
  id: string;

  /** Nom de la carte dans la langue de l'utilisateur */
  name: string;

  /** Set (edition) auquel appartient la carte */
  set: CardSet;

  /** Numero de la carte dans son set */
  number: string;

  /** Niveau de rarete */
  rarity: CardRarity;

  /** Types elementaires de la carte */
  types: string[];

  /** Points de vie (0 pour les cartes Dresseur/Energie) */
  hp: number;

  /** URL de l'image de la carte (CDN) */
  imageUrl: string;

  /** Date d'ajout dans la base CollectionR */
  createdAt: string;
}

interface CardSet {
  /** Identifiant du set (ex: "swsh3") */
  id: string;

  /** Nom complet du set (ex: "Tenebres Embrasees") */
  name: string;

  /** Date de sortie du set */
  releaseDate: string;
}
```

---

## 2. Nommage

### Fichiers

| Type de fichier | Convention | Exemple |
|---|---|---|
| Composant React | PascalCase.tsx | `CardPreview.tsx`, `PriceTag.tsx` |
| Hook custom | useCamelCase.ts | `useCards.ts`, `useCardScanner.ts` |
| Store Zustand | camelCaseStore.ts | `collectionStore.ts`, `authStore.ts` |
| Service API | camelCase.ts | `cardService.ts`, `priceService.ts` |
| Utilitaire | camelCase.ts | `formatPrice.ts`, `validators.ts` |
| Type / Interface | camelCase.ts | `card.ts`, `collection.ts` |
| Constante | camelCase.ts | `routes.ts`, `endpoints.ts` |
| Test | meme nom + .test.tsx | `CardPreview.test.tsx`, `useCards.test.ts` |

### Variables et fonctions

| Type | Convention | Exemple |
|---|---|---|
| Variable locale | camelCase | `cardList`, `isLoading`, `totalPrice` |
| Fonction | camelCase, verbe d'action | `fetchCards()`, `handleSubmit()`, `formatPrice()` |
| Constante | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_CARDS_PER_PAGE`, `STALE_TIME_CARDS` |
| Booleens | prefixe `is`, `has`, `should`, `can` | `isAuthenticated`, `hasCollection`, `canScan` |
| Handlers d'evenement | prefixe `handle` | `handleCardPress`, `handleSearchChange` |
| Props callback | prefixe `on` | `onPress`, `onSearchChange`, `onCardSelect` |

### Composants et Props

| Type | Convention | Exemple |
|---|---|---|
| Composant | PascalCase | `CardPreview`, `CollectionGrid` |
| Interface de props | Nom du composant + Props | `CardPreviewProps`, `CollectionGridProps` |
| Skeleton | Nom du composant + Skeleton | `CardPreviewSkeleton` |

---

## 3. Imports

L'ordre des imports est standardise pour faciliter la lecture. ESLint enforce cet ordre automatiquement.

### Ordre obligatoire

Chaque groupe est separe par une ligne vide :

```typescript
// 1. React et React Native
import { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';

// 2. Librairies externes
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';

// 3. Composants internes (alias @/)
import { Button, PriceTag } from '@/components/atoms';
import { CardPreview } from '@/components/molecules';

// 4. Hooks, stores, services
import { useCards } from '@/hooks';
import { useFiltersStore } from '@/stores';

// 5. Types (toujours en import type)
import type { Card, CardCondition } from '@/types';

// 6. Constantes et utils
import { ROUTES } from '@/constants';
import { formatPrice } from '@/utils';
```

### Regles d'import

```typescript
// OBLIGATOIRE : alias @/ pour tout import interne
import { Button } from '@/components/atoms';

// INTERDIT : import relatif profond
import { Button } from '../../../components/atoms/Button/Button';

// OBLIGATOIRE : import depuis le barrel (index.ts)
import { Button, Input } from '@/components/atoms';

// INTERDIT : import depuis le fichier interne
import { Button } from '@/components/atoms/Button/Button';

// OBLIGATOIRE : import type pour les types purs
import type { Card } from '@/types';

// INTERDIT : import * (empeche le tree-shaking)
import * as CardTypes from '@/types/card';
```

---

## 4. Commentaires

Les commentaires JSDoc sont obligatoires sur toutes les fonctions exportees et toutes les interfaces de props. Ils servent a l'autocompletion de l'IDE et a la documentation automatique.

### JSDoc obligatoire

```typescript
/** Formate un prix numerique en chaine affichable avec devise.
 * @param value - Montant en nombre (ex: 42.5)
 * @param currency - Code devise ISO (ex: "EUR")
 * @returns Chaine formatee (ex: "42,50 EUR")
 */
export function formatPrice(value: number, currency: string): string {
  return `${value.toFixed(2).replace('.', ',')} ${currency}`;
}
```

```typescript
/** Apercu compact d'une carte pour affichage en liste. */
interface CardPreviewProps {
  /** Identifiant unique de la carte */
  id: string;
  /** Nom affiche de la carte */
  name: string;
  /** Callback quand l'utilisateur appuie sur la carte */
  onPress?: (id: string) => void;
}
```

### Commentaires inline

Les commentaires inline dans le corps des fonctions sont interdits sauf quand la logique est veritablement complexe (algorithme, workaround pour un bug connu). Si un commentaire est necessaire, c'est souvent un signe que le code devrait etre refactorise ou extrait dans une fonction nommee.

```typescript
// INTERDIT : commentaire qui repete le code
const total = items.reduce((sum, item) => sum + item.price, 0); // calcule le total

// ACCEPTABLE : explication d'un workaround
// Workaround pour un bug Expo Camera sur Android 14 : le premier appel
// a takePictureAsync retourne parfois null, on retente une fois.
const photo = await cameraRef.current.takePictureAsync() ?? await cameraRef.current.takePictureAsync();
```

---

## 5. Gestion d'erreurs

Les erreurs silencieuses sont le cauchemar du debugging. Chaque erreur attrapee doit etre visible pour l'utilisateur ou tracee pour le developpeur.

### Pattern standard

```typescript
// Pattern pour les actions utilisateur (mutation)
const handleAddCard = async () => {
  try {
    await addCardToCollection({ cardId, condition: 'NM', quantity: 1 });
    showToast({ type: 'success', message: 'Carte ajoutee a la collection' });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      showToast({ type: 'warning', message: 'Cette carte est deja dans votre collection' });
    } else {
      showToast({ type: 'error', message: 'Impossible d\'ajouter la carte. Reessayez.' });
    }
  }
};
```

### Regles

```typescript
// INTERDIT : catch silencieux
try {
  await fetchCards();
} catch (e) {
  // rien
}

// INTERDIT : console.log en production
try {
  await fetchCards();
} catch (e) {
  console.log('error', e);
}

// CORRECT : feedback utilisateur
try {
  await fetchCards();
} catch (error) {
  showToast({ type: 'error', message: 'Impossible de charger les cartes' });
}
```

### Pas de console.log en production

La regle ESLint `no-console` est activee en mode `error`. Utiliser un service de logging structure pour le debugging en production.

---

## 6. Hooks custom attendus

Ces hooks encapsulent la logique metier reutilisable du projet. Chacun a une responsabilite unique.

| Hook | Responsabilite | Plateforme |
|---|---|---|
| `useCards` | Recuperer la liste des cartes (TanStack Query) | Web et Mobile |
| `useCard(id)` | Recuperer le detail d'une carte | Web et Mobile |
| `useSearchCards(query)` | Rechercher des cartes avec debounce | Web et Mobile |
| `useCollection` | Recuperer la collection de l'utilisateur | Web et Mobile |
| `useAddCard` | Mutation : ajouter une carte a la collection | Web et Mobile |
| `useRemoveCard` | Mutation : retirer une carte de la collection | Web et Mobile |
| `useCardScanner` | Piloter le flux de scan camera | Mobile uniquement |
| `usePriceFormatter` | Formater les prix selon la locale et la devise | Web et Mobile |
| `useAuth` | Login, logout, refresh token | Web et Mobile |
| `useMarketPrice(cardId)` | Recuperer les prix du marche pour une carte | Web et Mobile |

---

## 7. Anti-patterns interdits

Ces patterns sont interdits car ils ont cause des bugs ou de la confusion dans des projets similaires. Chaque regle est accompagnee de l'alternative correcte.

| Anti-pattern | Pourquoi c'est interdit | Alternative |
|---|---|---|
| `any` | Desactive le typage, masque les bugs | `unknown` avec type guard, ou typer precisement |
| `console.log` | Pollue la console en production, pas de valeur en prod | Service de logging ou supprimer |
| `// @ts-ignore` | Cache une erreur de type au lieu de la corriger | Corriger le type, ou `// @ts-expect-error` avec justification |
| `export default` | Rend les imports renommables silencieusement, complique le refactoring | Export nomme `export function` |
| `import * as` | Empeche le tree-shaking, augmente le bundle | Imports nommes |
| Fetch dans un composant | Melange UI et data, impossible a tester | Hook TanStack Query |
| `useEffect` pour du data fetching | Race conditions, pas de cache, pas de deduplication | `useQuery` de TanStack Query |
| Index comme key dans une liste | Bug de reconciliation React quand la liste change | Identifiant unique (`item.id`) |
| Etat serveur dans Zustand | Duplication avec TanStack Query, desynchronisation | TanStack Query pour le server state |
| Styles inline hardcodes | Incoherence visuelle, pas de design system | Tokens Tailwind du design system |
| `!important` en CSS | Casse la cascade, masque les conflits | Corriger la specificite ou utiliser une classe utilitaire |
| Props drilling > 2 niveaux | Code fragile, difficile a suivre | Store Zustand ou Context |

---

## Voir aussi

- [03-composants.md](./03-composants.md) -- Template de composant et structure de fichiers
- [05-data-et-etat.md](./05-data-et-etat.md) -- Zustand, TanStack Query et regles de decision
- [06-contributing.md](./06-contributing.md) -- Checklist avant Pull Request et strategie de tests
- [02-design-system.md](./02-design-system.md) -- Tokens de design et animations
