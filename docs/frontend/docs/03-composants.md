> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Conventions de composants -- CollectionR

Ce document definit comment creer, nommer et organiser les composants dans le projet. Respecter ces conventions garantit qu'un developpeur qui ouvre un fichier comprend immediatement sa place dans l'application.

---

## 1. Les 5 niveaux Atomic Design

Chaque niveau a un role precis. Un composant mal place cree de la confusion pour toute l'equipe.

### Atom -- Element de base indivisible

Un atome est le composant le plus petit qui a du sens visuellement. Il ne contient aucune logique metier et ne connait pas le contexte dans lequel il est utilise.

```typescript
/** Affiche un prix avec une indication de tendance (hausse, baisse, stable). */
interface PriceTagProps {
  /** Valeur du prix en euros */
  value: number;
  /** Direction de la tendance */
  trend?: 'up' | 'down' | 'stable';
}

export function PriceTag({ value, trend = 'stable' }: PriceTagProps) {
  const trendColor = {
    up: 'text-success',
    down: 'text-error',
    stable: 'text-muted',
  }[trend];

  return (
    <Text className={`text-lg font-bold ${trendColor}`}>
      {formatPrice(value, 'EUR')}
    </Text>
  );
}
```

Usage : `<PriceTag value={12.50} trend="up" />`

### Molecule -- Groupe fonctionnel d'atomes

Une molecule combine quelques atomes pour former un bloc ayant une fonction. Elle peut recevoir des donnees via props mais ne les recupere pas elle-meme.

```typescript
/** Apercu d'une carte avec son image, son nom et son edition. */
interface CardPreviewProps {
  /** Identifiant unique de la carte */
  id: string;
  /** Nom de la carte */
  name: string;
  /** Nom de l'edition */
  edition: string;
  /** URL de l'image de la carte */
  imageUrl: string;
  /** Callback quand l'utilisateur appuie sur la carte */
  onPress?: (id: string) => void;
}

export function CardPreview({ id, name, edition, imageUrl, onPress }: CardPreviewProps) {
  return (
    <Pressable
      className="rounded-xl bg-surface shadow-sm p-4"
      onPress={() => onPress?.(id)}
    >
      <Image source={{ uri: imageUrl }} className="w-full h-48 rounded-lg" />
      <Text className="text-lg font-semibold mt-3">{name}</Text>
      <Text className="text-sm text-muted">{edition}</Text>
    </Pressable>
  );
}
```

Usage : `<CardPreview id="xxx" name="Pikachu" edition="Base Set" imageUrl="..." />`

### Organism -- Section complete

Un organisme assemble des molecules et atomes pour former une section fonctionnelle complete. Il peut utiliser des hooks pour la logique de presentation (tri, filtre) mais pas pour les appels API.

```typescript
/** Liste de cartes avec gestion du scroll et de la selection. */
interface CardListProps {
  /** Liste des cartes a afficher */
  cards: Card[];
  /** Indique si les donnees sont en cours de chargement */
  isLoading: boolean;
  /** Callback quand l'utilisateur appuie sur une carte */
  onCardPress: (cardId: string) => void;
}

export function CardList({ cards, isLoading, onCardPress }: CardListProps) {
  if (isLoading) {
    return (
      <View className="gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardPreviewSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (cards.length === 0) {
    return <EmptyState message="Aucune carte trouvee" />;
  }

  return (
    <FlatList
      data={cards}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <CardPreview
          id={item.id}
          name={item.name}
          edition={item.set.name}
          imageUrl={item.imageUrl}
          onPress={onCardPress}
        />
      )}
      contentContainerClassName="gap-3 p-4"
    />
  );
}
```

Usage : `<CardList cards={cards} isLoading={isLoading} onCardPress={handlePress} />`

### Template -- Mise en page

Un template definit la disposition spatiale d'une page sans connaitre les donnees. Il recoit ses enfants via props ou slots.

```typescript
/** Layout a deux colonnes avec sidebar et contenu principal. */
interface CollectionLayoutProps {
  /** Contenu de la sidebar (filtres, stats) */
  sidebar: React.ReactNode;
  /** Contenu principal (liste de cartes) */
  content: React.ReactNode;
}

export function CollectionLayout({ sidebar, content }: CollectionLayoutProps) {
  return (
    <View className="flex-1 flex-row">
      <View className="w-64 border-r border-default p-4">{sidebar}</View>
      <View className="flex-1 p-6">{content}</View>
    </View>
  );
}
```

Usage : `<CollectionLayout sidebar={<FilterPanel />} content={<CardList ... />} />`

### Page -- Connectee aux donnees et au routeur

Une page est le point d'entree d'un ecran. C'est le seul niveau qui utilise les hooks de donnees (TanStack Query) et les stores (Zustand). Elle orchestre tout et passe les donnees aux composants enfants via props.

```typescript
/** Page de la collection de l'utilisateur. */
export function CollectionPage() {
  const { data: collection, isLoading, isError, error } = useCollection();
  const filters = useFiltersStore((s) => s.filters);
  const navigation = useNavigation();

  const handleCardPress = useCallback((cardId: string) => {
    navigation.navigate('CardDetail', { cardId });
  }, [navigation]);

  if (isError) {
    return <ErrorState message={error.message} />;
  }

  return (
    <CollectionLayout
      sidebar={<FilterPanel />}
      content={
        <CardList
          cards={collection?.items ?? []}
          isLoading={isLoading}
          onCardPress={handleCardPress}
        />
      }
    />
  );
}
```

Usage : relie au routeur, jamais instancie manuellement.

---

## 2. Template de fichier composant

Chaque composant suit cette structure. La copier pour creer un nouveau composant.

```typescript
// src/components/molecules/CardPreview/CardPreview.tsx

import { View, Text, Pressable } from 'react-native';
import { Image } from 'expo-image';

import { PriceTag } from '@/components/atoms';
import type { CardCondition } from '@/types';

// -- Props --------------------------------------------------------

/** Apercu compact d'une carte pour l'affichage en liste ou grille. */
interface CardPreviewProps {
  /** Identifiant unique de la carte */
  id: string;
  /** Nom affiche de la carte */
  name: string;
  /** Nom de l'edition (set) */
  edition: string;
  /** URL de l'image de la carte */
  imageUrl: string;
  /** Prix actuel du marche en euros (optionnel) */
  price?: number;
  /** Etat physique de la carte */
  condition?: CardCondition;
  /** Callback au tap sur la carte */
  onPress?: (id: string) => void;
}

// Valeurs par defaut pour les props optionnelles
const DEFAULT_CONDITION: CardCondition = 'NM';

// -- Composant ----------------------------------------------------

export function CardPreview({
  id,
  name,
  edition,
  imageUrl,
  price,
  condition = DEFAULT_CONDITION,
  onPress,
}: CardPreviewProps) {
  return (
    <Pressable
      className="rounded-xl bg-surface shadow-sm p-4 active:scale-[0.97]"
      onPress={() => onPress?.(id)}
      accessibilityRole="button"
      accessibilityLabel={`Carte ${name}, edition ${edition}`}
    >
      <Image
        source={{ uri: imageUrl }}
        className="w-full h-48 rounded-lg"
        contentFit="contain"
        transition={200}
      />
      <Text className="text-lg font-semibold mt-3">{name}</Text>
      <View className="flex-row justify-between items-center mt-1">
        <Text className="text-sm text-muted">{edition}</Text>
        {price !== undefined && <PriceTag value={price} />}
      </View>
      <Text className="text-xs text-muted mt-1">Etat : {condition}</Text>
    </Pressable>
  );
}
```

### Structure de fichiers pour un composant

```
CardPreview/
|-- CardPreview.tsx           # Composant principal
|-- CardPreviewSkeleton.tsx   # Skeleton loader
|-- CardPreview.test.tsx      # Tests
|-- index.ts                  # Re-export : export { CardPreview } from './CardPreview';
```

---

## 3. Regles de nommage

La coherence du nommage permet de deviner le contenu d'un fichier sans l'ouvrir.

| Type | Convention | Exemple |
|---|---|---|
| Composant | PascalCase | `CardPreview`, `PriceTag`, `ScanButton` |
| Hook | camelCase prefixe `use` | `useCards`, `useCardScanner`, `usePriceFormatter` |
| Store | camelCase prefixe `use` + `Store` | `useCollectionStore`, `useAuthStore` |
| Constante | UPPER_SNAKE_CASE | `API_BASE_URL`, `MAX_CARDS_PER_PAGE` |
| Fichier composant | PascalCase.tsx | `CardPreview.tsx` |
| Fichier hook | useCamelCase.ts | `useCards.ts` |
| Fichier utilitaire | camelCase.ts | `formatPrice.ts` |

---

## 4. Regle du props drilling

Le props drilling (passer des props a travers plusieurs niveaux de composants) est acceptable sur 2 niveaux maximum. Au-dela, le code devient difficile a suivre et a maintenir.

```
Page --> Organism --> Molecule    # OK : 2 niveaux
Page --> Organism --> Molecule --> Atom   # TROP : 3 niveaux
```

Solutions quand le drilling depasse 2 niveaux :
- **Store Zustand** pour l'etat global (theme, auth, filtres)
- **React Context** pour l'etat local a un sous-arbre (ex: un formulaire multi-etapes)
- **Hook intermediaire** qui combine store + logique

---

## 5. Quand creer un composant vs reutiliser

Creer un nouveau composant quand :
- Le meme bloc de JSX apparait 3 fois ou plus dans le code
- Le bloc a une responsabilite clairement definie (un nom naturel lui vient facilement)
- Le bloc a des props qui varient selon le contexte d'utilisation

Ne pas creer un composant quand :
- Le code n'apparait qu'une fois et n'a pas vocation a etre reutilise
- Le composant n'aurait qu'une seule prop (souvent un signe de sur-abstraction)
- Extraire le composant rendrait le code parent plus difficile a lire

---

## 6. Composants Skeleton / Shimmer

Regle obligatoire : tout composant qui affiche des donnees asynchrones doit avoir un skeleton correspondant. Un ecran qui affiche un spinner au centre pendant 2 secondes est une mauvaise experience utilisateur. Un skeleton qui reproduit la forme du contenu final est bien meilleur.

### Convention

Pour chaque composant `NomComposant.tsx`, creer un `NomComposantSkeleton.tsx` dans le meme dossier :

```typescript
// CardPreview/CardPreviewSkeleton.tsx

/** Skeleton du composant CardPreview, affiche pendant le chargement. */
export function CardPreviewSkeleton() {
  return (
    <View className="rounded-xl bg-surface shadow-sm p-4">
      <View className="w-full h-48 rounded-lg bg-surface-alt animate-pulse" />
      <View className="h-5 w-3/4 mt-3 rounded bg-surface-alt animate-pulse" />
      <View className="flex-row justify-between items-center mt-2">
        <View className="h-4 w-1/3 rounded bg-surface-alt animate-pulse" />
        <View className="h-5 w-16 rounded bg-surface-alt animate-pulse" />
      </View>
    </View>
  );
}
```

### Utilisation dans un organisme

```typescript
function CardList({ cards, isLoading, onCardPress }: CardListProps) {
  if (isLoading) {
    return (
      <View className="gap-3 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <CardPreviewSkeleton key={i} />
        ))}
      </View>
    );
  }
  // ... rendu normal
}
```

---

## Voir aussi

- [02-design-system.md](./02-design-system.md) -- Tokens de couleur, espacement, typographie et animations
- [04-conventions-code.md](./04-conventions-code.md) -- Regles TypeScript et imports
- [05-data-et-etat.md](./05-data-et-etat.md) -- Hooks TanStack Query et stores Zustand
- [01-architecture.md](./01-architecture.md) -- Structure des dossiers et placement des composants
