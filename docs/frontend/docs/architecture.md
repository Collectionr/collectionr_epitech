> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-03-22
> **Audience :** Toute l'equipe, en particulier les nouveaux contributeurs

# Architecture Frontend -- CollectionR

---

## 1. Choix architectural : Atomic Design + Layered Architecture

L'architecture frontend repose sur deux piliers complementaires. Atomic Design organise les composants UI par granularite, tandis que Layered Architecture separe la logique metier de la presentation.

### Pourquoi Atomic Design ?

Atomic Design decompose l'interface en 5 niveaux de granularite. Ce choix garantit la reutilisabilite des composants de base et la coherence visuelle a travers toute l'application.

| Niveau | Description | Exemple CollectionR |
|---|---|---|
| Atoms | Elements UI de base, indivisibles | `Button`, `Input`, `Badge`, `PriceTag` |
| Molecules | Combinaison de quelques atomes | `CardPreview`, `SearchBar`, `FormField` |
| Organisms | Sections completes | `CardList`, `ScanResult`, `CollectionGrid` |
| Templates | Mises en page sans donnees | `DashboardLayout`, `CollectionLayout` |
| Pages | Templates connectees aux donnees et au routeur | `CollectionPage`, `CardDetailPage` |

### Pourquoi Layered Architecture ?

En complement d'Atomic Design pour les composants, le reste du code est organise en couches separees. Chaque couche a une responsabilite unique, ce qui facilite les tests et la maintenance.

| Couche | Responsabilite |
|---|---|
| UI (components) | Rendu visuel, pas de logique metier |
| Hooks | Logique reutilisable, orchestration |
| Services | Communication avec le backend (appels API) |
| Stores | Etat global client (Zustand) |
| Types | Definitions TypeScript partagees |
| Utils | Fonctions utilitaires pures |

### Quand migrer vers Feature-Sliced Design ?

L'architecture actuelle est adaptee a la phase 1 du projet. La migration vers Feature-Sliced Design (FSD) sera envisagee si :

- Le nombre de fonctionnalites depasse 15+ features distinctes
- Les imports cross-feature deviennent frequents et difficiles a tracer
- L'equipe frontend depasse 4+ developpeurs travaillant simultanement
- Le temps pour localiser un fichier depasse regulierement les 10 secondes

---

## 2. Arborescence du dossier src/

Cette arborescence est la reference. Chaque nouveau fichier doit respecter cette structure.

```
src/
|-- components/              # Composants UI reutilisables (Atomic Design)
|   |-- atoms/               # Composants de base (Button, Input, Badge, PriceTag, Icon, Loader)
|   |-- molecules/           # Groupes de composants (CardPreview, SearchBar, PriceTag, FormField)
|   |-- organisms/           # Sections completes (CardList, ScanResult, CollectionGrid, AddCardForm)
|   |-- templates/           # Mises en page (DashboardLayout, CollectionLayout, AuthLayout)
|   |-- pages/               # Pages reliees au routeur (CollectionPage, CardDetailPage, ScanPage)
|
|-- hooks/                   # Custom hooks metier (useCards, useCollection, useCardScanner, usePriceFormatter)
|
|-- stores/                  # Stores Zustand (useCollectionStore, useAuthStore, useUIStore, useFiltersStore)
|
|-- services/                # Appels API (wrappers autour de fetch, consommes par les hooks TanStack Query)
|   |-- cardService.ts       # Endpoints cartes : getCard, searchCards, getCardsBySet
|   |-- collectionService.ts # Endpoints collection : getCollection, addCard, removeCard
|   |-- priceService.ts      # Endpoints prix : getMarketPrice
|   |-- scannerService.ts    # Endpoint scan : uploadImage, identifyCard
|   |-- authService.ts       # Endpoints auth : login, register, refreshToken
|   |-- apiClient.ts         # Instance HTTP configuree (base URL, headers, interceptors)
|
|-- types/                   # Interfaces et types TypeScript partages
|   |-- card.ts              # Card, CardSet, CardRarity, CardCondition
|   |-- collection.ts        # Collection, CollectionItem
|   |-- user.ts              # User, AuthTokens
|   |-- price.ts             # MarketPrice, PriceSource, PriceTrend
|   |-- api.ts               # ApiResponse, PaginatedResponse, ApiError
|   |-- navigation.ts        # Types React Navigation (params de chaque ecran)
|
|-- utils/                   # Fonctions utilitaires pures
|   |-- formatPrice.ts       # Formatage de prix (devise, decimales, signe +/-)
|   |-- formatDate.ts        # Formatage de dates
|   |-- validators.ts        # Validation de formulaires
|   |-- storage.ts           # Abstraction AsyncStorage / localStorage
|
|-- constants/               # Constantes et configuration
|   |-- routes.ts            # Noms de routes (web et mobile)
|   |-- endpoints.ts         # URLs des endpoints API
|   |-- config.ts            # Variables d'environnement typees
|   |-- queryKeys.ts         # Cles TanStack Query centralisees
|
|-- assets/                  # Ressources statiques
|   |-- images/              # Images et illustrations
|   |-- fonts/               # Polices custom
|   |-- icons/               # Icones SVG ou icon font
|
|-- styles/                  # Tokens globaux Tailwind / theme
|   |-- tailwind.config.ts   # Configuration Tailwind etendue (couleurs, espacements, fonts)
|   |-- theme.ts             # Tokens de theme exportes pour usage programmatique
|   |-- globals.css           # Styles globaux (web uniquement)
|
|-- navigation/              # Configuration React Navigation (mobile)
|   |-- RootNavigator.tsx    # Navigateur racine
|   |-- TabNavigator.tsx     # Navigation par onglets
|   |-- AuthNavigator.tsx    # Stack d'authentification
|   |-- linking.ts           # Configuration deep linking
|
|-- App.tsx                  # Point d'entree de l'application
|-- index.ts                 # Entry point (Expo / Vite)
```

---

## 3. Web vs Mobile : partage et specificites

Le code est partage au maximum entre web et mobile. Les dossiers suivants sont communs aux deux plateformes.

### Dossiers partages (web et mobile)

| Dossier | Partage | Notes |
|---|---|---|
| `types/` | 100% | Toutes les interfaces sont identiques |
| `stores/` | 100% | Zustand fonctionne sur les deux plateformes |
| `services/` | 100% | Les appels API sont identiques |
| `hooks/` | 90% | Sauf `useCardScanner` (mobile uniquement) |
| `utils/` | 100% | Fonctions pures, pas de dependance plateforme |
| `constants/` | 100% | Sauf les routes qui different |

### Dossiers specifiques

| Dossier | Specificite | Notes |
|---|---|---|
| `navigation/` | Mobile uniquement | React Navigation (pas utilise sur le web) |
| `styles/globals.css` | Web uniquement | CSS global pour le web |
| `components/pages/ScanPage` | Mobile uniquement | La camera n'est pas disponible sur desktop |

### Resolution par plateforme

Quand un composant a un rendu different sur web et mobile, utiliser les extensions de fichier. Metro (mobile) et Vite (web) resolvent automatiquement la bonne version.

```
CardPreview.tsx          # Code par defaut (partage)
CardPreview.web.tsx      # Rendu specifique web
CardPreview.native.tsx   # Rendu specifique mobile (React Native)
```

---

## 4. Schema des couches

Ce schema montre le flux de donnees de l'utilisateur au serveur. Chaque couche ne communique qu'avec la couche adjacente.

```
+---------------------------------------------------------------+
|                        UI LAYER                                |
|  components/ (atoms, molecules, organisms, templates, pages)   |
|  Responsabilite : rendu visuel uniquement, recoit des props    |
+---------------------------------------------------------------+
                           |
                           | props, callbacks
                           v
+---------------------------------------------------------------+
|                   BUSINESS LOGIC LAYER                         |
|  hooks/ (useCards, useCollection, useCardScanner...)           |
|  stores/ (useCollectionStore, useAuthStore, useUIStore...)     |
|  Responsabilite : orchestration, etat, logique metier          |
+---------------------------------------------------------------+
                           |
                           | appels de fonctions
                           v
+---------------------------------------------------------------+
|                      DATA LAYER                                |
|  services/ (cardService, collectionService, priceService...)   |
|  Responsabilite : communication HTTP avec le backend           |
+---------------------------------------------------------------+
                           |
                           | HTTP REST
                           v
+---------------------------------------------------------------+
|                   BACKEND (NestJS + Fastify)                   |
+---------------------------------------------------------------+
```

---

## 5. Regle d'or

Un composant ne fait jamais d'appel API directement. Il utilise un hook.

Cette regle existe pour separer la presentation de la logique de donnees. Un composant qui appelle `fetch` ou un service directement devient impossible a tester en isolation et difficile a reutiliser.

```typescript
// INTERDIT : appel API dans un composant
function CardDetail({ id }: { id: string }) {
  const [card, setCard] = useState<Card | null>(null);
  useEffect(() => {
    fetch(`/cards/${id}`).then(r => r.json()).then(setCard);
  }, [id]);
  return <Text>{card?.name}</Text>;
}

// CORRECT : le composant utilise un hook
function CardDetail({ id }: { id: string }) {
  const { data: card, isLoading } = useCard(id);
  if (isLoading) return <CardDetailSkeleton />;
  return <Text>{card?.name}</Text>;
}
```

---

## 6. Alias de chemins

Les imports relatifs profonds (`../../../`) sont interdits. Le projet utilise des alias configures dans `tsconfig.json`.

| Alias | Chemin reel |
|---|---|
| `@/components` | `src/components` |
| `@/hooks` | `src/hooks` |
| `@/services` | `src/services` |
| `@/stores` | `src/stores` |
| `@/types` | `src/types` |
| `@/utils` | `src/utils` |
| `@/constants` | `src/constants` |
| `@/assets` | `src/assets` |
| `@/styles` | `src/styles` |
| `@/navigation` | `src/navigation` |

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## Voir aussi

- [design-system.md](./design-system.md) -- Tokens visuels utilises dans les composants
- [composants.md](./composants.md) -- Conventions de creation des composants
- [conventions-code.md](./conventions-code.md) -- Regles TypeScript et nommage
- [data-et-etat.md](./data-et-etat.md) -- Zustand, TanStack Query et regles de decision
- [CONTRIBUTING.md (global)](../../CONTRIBUTING.md) -- Onboarding et workflow Git
