> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-09-25
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

## 2. Arborescence du monorepo

Le frontend est organise en monorepo (workspaces npm) : deux applications distinctes et un package de logique partagee. Cette arborescence est la reference. Chaque nouveau fichier doit y respecter sa place.

```
.
|-- apps/
|   |-- web/                  # Application web (React + Vite + Tailwind)
|   |   |-- src/
|   |   |   |-- components/   # Composants UI web (Atomic Design)
|   |   |   |-- pages/        # Pages reliees au routeur web
|   |   |   |-- styles/       # globals.css + tailwind.config.ts
|   |   |   |-- assets/       # Images, polices, icones web
|   |   |   |-- App.tsx       # Racine de l'app web
|   |   |   |-- main.tsx      # Entry point Vite
|   |   |-- index.html
|   |   |-- vite.config.ts
|   |   |-- package.json
|   |
|   |-- mobile/               # Application mobile (Expo / React Native + NativeWind -> iOS + Android)
|       |-- src/
|       |   |-- components/   # Composants UI mobile (Atomic Design)
|       |   |-- screens/      # Ecrans relies a la navigation
|       |   |-- navigation/   # React Navigation (RootNavigator, TabNavigator, AuthNavigator, linking)
|       |   |-- assets/       # Images, polices, icones mobile
|       |-- App.tsx           # Entry point Expo
|       |-- app.json
|       |-- package.json
|
|-- packages/
|   |-- shared/               # Logique pure partagee web + mobile (AUCUN composant visuel / JSX)
|       |-- src/
|       |   |-- hooks/        # Custom hooks metier (useCards, useCollection, useCardScanner, usePriceFormatter)
|       |   |-- stores/       # Stores Zustand (useCollectionStore, useAuthStore, useUIStore, useFiltersStore)
|       |   |-- services/     # Appels API (cardService, collectionService, priceService, scannerService, authService, apiClient)
|       |   |-- types/        # Interfaces TypeScript (card, collection, user, price, api, navigation)
|       |   |-- utils/        # Fonctions pures (formatPrice, formatDate, validators, storage)
|       |   |-- validation/   # Schemas de validation (formulaires, reponses API)
|       |   |-- constants/    # endpoints, queryKeys, config
|       |   |-- tokens/       # Design tokens partages (couleurs, typo, espacements)
|       |-- package.json
|
|-- package.json              # Racine du monorepo (workspaces)
```

---

## 3. Web et Mobile : deux apps, une logique partagee

Le decoupage entre web et mobile se fait PAR DOSSIER, via les deux apps du monorepo -- et non par suffixe de fichier. Il n'y a plus de fichiers `.web.tsx` / `.native.tsx`.

### Ce qui est partage : packages/shared

`packages/shared` contient TOUTE la logique non visuelle, consommee a l'identique par les deux apps :

| Domaine | Contenu |
|---|---|
| Hooks | Logique metier reutilisable (useCards, usePriceFormatter...) |
| Stores | Etat global Zustand |
| Services | Appels API (identiques web et mobile) |
| Types | Interfaces TypeScript |
| Validation | Schemas de validation |
| Formatage des prix | formatPrice et helpers monetaires |
| Tokens | Design tokens (couleurs, typo, espacements) |

`packages/shared` ne contient JAMAIS de rendu : aucun composant, aucun JSX.

### Ce qui est specifique a chaque app : le rendu

Le rendu vit dans chaque app, parce que web et mobile ont des ecrans differents, conformes a leurs wireframes respectifs :

| App | Stack | Specificites |
|---|---|---|
| `apps/web` | React + Vite + Tailwind | Routeur web, styles globaux CSS |
| `apps/mobile` | Expo / React Native + NativeWind | React Navigation, ecran de scan (camera, mobile uniquement) |

### Choix delibere : pas de composants UI partages

Contrairement a certains exemples de monorepo (ex. byCedric/expo-monorepo-example) qui partagent aussi des composants UI entre web et mobile via react-native-web, nous gardons le rendu dans chaque app. Raison : nos wireframes desktop et mobile divergent suffisamment pour qu'un composant reellement commun soit l'exception, pas la regle.

### Coherence visuelle : les design tokens

La coherence visuelle entre les deux apps n'est pas assuree par des composants communs, mais par les **design tokens partages** (`packages/shared/tokens`) : memes valeurs de couleurs, typographie et espacements, branchees dans Tailwind cote web et NativeWind cote mobile.

### Une seule version de React / React Native

Tout le monorepo utilise une seule version de React et de React Native. Deux versions differentes entre apps ou packages provoquent des erreurs runtime (hooks invalides, contextes React dupliques).

> References : [byCedric/expo-monorepo-example](https://github.com/byCedric/expo-monorepo-example), [hugo8barbosa/react-vite-monorepo](https://github.com/hugo8barbosa/react-vite-monorepo).

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

Les imports relatifs profonds (`../../../`) sont interdits. Avec le monorepo, deux familles d'alias coexistent : `@shared/*` pour la logique partagee, et `@/*` propre a chaque app pour son rendu.

### Logique partagee : `@shared/*`

Resolu partout vers `packages/shared/src/` :

| Alias | Chemin reel |
|---|---|
| `@shared/hooks` | `packages/shared/src/hooks` |
| `@shared/stores` | `packages/shared/src/stores` |
| `@shared/services` | `packages/shared/src/services` |
| `@shared/types` | `packages/shared/src/types` |
| `@shared/utils` | `packages/shared/src/utils` |
| `@shared/validation` | `packages/shared/src/validation` |
| `@shared/constants` | `packages/shared/src/constants` |
| `@shared/tokens` | `packages/shared/src/tokens` |

### Rendu local a chaque app : `@/*`

Resolu vers le `src/` de l'app courante uniquement (jamais celui de l'autre app) :

| Alias | apps/web | apps/mobile |
|---|---|---|
| `@/components` | `apps/web/src/components` | `apps/mobile/src/components` |
| `@/pages` | `apps/web/src/pages` | -- |
| `@/screens` | -- | `apps/mobile/src/screens` |
| `@/styles` | `apps/web/src/styles` | -- |
| `@/navigation` | -- | `apps/mobile/src/navigation` |
| `@/assets` | `apps/web/src/assets` | `apps/mobile/src/assets` |

Pour consommer la logique partagee, toujours passer par `@shared/*` ; le `@/*` d'une app ne pointe que vers son propre `src/`.

### Configuration

Les alias sont declares a deux endroits qui doivent rester synchronises : TypeScript (verification des types, IDE) et le bundler (resolution en dev et au build).

`frontend/tsconfig.base.json` porte les options de compilation communes, mais aucun `paths` : dans un tsconfig qui en etend un autre, `paths` remplace celui du parent au lieu de s'y ajouter. Chaque app declare donc elle-meme ses deux alias. Pas de `baseUrl` (deprecie depuis TypeScript 6) : les chemins sont relatifs au tsconfig.

```json
// apps/web/tsconfig.json -- les deux alias de l'app (meme principe pour apps/mobile)
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@shared/*": ["../../packages/shared/src/*"]
    }
  }
}
```

```typescript
// apps/web/vite.config.ts -- les memes alias cote Vite
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../../packages/shared/src', import.meta.url)),
    },
  },
});
```

En plus de l'alias, `apps/web/package.json` declare `"@collectionr/shared": "*"` en dependance workspace : l'alias sert aux imports, la dependance rend le graphe entre packages explicite (installation ciblee d'un workspace).

---

## Voir aussi

- [design-system.md](./design-system.md) -- Tokens visuels utilises dans les composants
- [composants.md](./composants.md) -- Conventions de creation des composants
- [conventions-code.md](./conventions-code.md) -- Regles TypeScript et nommage
- [data-et-etat.md](./data-et-etat.md) -- Zustand, TanStack Query et regles de decision
- [CONTRIBUTING.md (global)](../../CONTRIBUTING.md) -- Onboarding et workflow Git
