> **Maintenu par :** Francois Dubois (PO / Frontend Lead)
> **Derniere mise a jour :** 2026-11-26
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
|   |   |   |-- pages/        # Pages reliees au routeur web, un dossier par page
|   |   |   |-- router/       # Routes, chemins (routes.ts), enveloppes de page, liens internes
|   |   |   |-- config/       # Assemblage de l'app : client API, session, cache
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
|       |   |-- stores/       # Stores Zustand (authStore, useCollectionStore, useUIStore, useFiltersStore)
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

## 7. Routing web : React Router 7, mode data

Le web utilise **React Router 7.18** en mode data (`createBrowserRouter` + `RouterProvider`), decision du 25/11/2026 (COLLR-696). La version 8 exige React 19.2.7 ou plus, alors que le monorepo est fige en React 19.2.3 pour Expo : la montee en 8 suivra celle de React.

| Fichier (`apps/web/src/router/`) | Role |
|---|---|
| `routes.ts` | Seul endroit ou les chemins sont ecrits (`ROUTES`), plus `collectionPath(id)` et `addCardPath(collectionId)` pour les chemins a parametre. Aucun composant n'ecrit d'URL en dur |
| `router.tsx` | Declaration des routes (`appRoutes`, reutilisees par les tests sur un routeur en memoire) et routeur du navigateur |
| `RootLayout.tsx` | Racine de toutes les routes : lance la restauration de la session et la navigation des liens internes |
| `RequireAuth.tsx` | Garde des pages connectees (Dashboard, collections, ajout, profil, pages provisoires de la Sidebar) |
| `ConnectedLayout.tsx` | Cadre des pages connectees (AppLayout), sous `RequireAuth` : Sidebar, Topbar et zone de contenu (voir ci-dessous) |
| `RedirectIfAuthenticated.tsx` | Garde des pages visiteurs (connexion, inscription, mot de passe oublie) |
| `StartupScreen.tsx` | Ecran de demarrage, et ecran d'erreur de la restauration |
| `RootErrorScreen.tsx` | Ecran d'erreur de la route racine (`errorElement`), pour les erreurs qui sortent des pages |
| `PageRoute.tsx` | Enveloppe de chaque page : `RouteErrorBoundary` puis `Suspense` |
| `usePageTitle.ts` | Titre fourni par chaque page : onglet (« Ma Collection · Collectionr ») et, dans le cadre, Topbar |
| `useDocumentTitle.ts` | Titre de l'onglet seul, pour les pages hors cadre (connexion, inscription, 404) |
| `internalLinks.ts` | Navigation des liens internes en `<a href>` natif (voir ci-dessous) |

Regles :

- **Pages chargees a la demande** : chaque page est importee avec `lazy()` depuis son propre dossier (`@/pages/DashboardPage`), jamais depuis un barrel commun a toutes les pages, qui les regrouperait dans le meme fichier JavaScript.
- **Attente** : seule la zone de la page attend. Le fallback de `Suspense` n'affiche rien pendant 400 ms, puis « Chargement… » en caption `acier-texte`, jamais de spinner.
- **Erreurs** : une page qui ne charge pas ou dont le rendu echoue affiche l'ecran d'erreur de `RouteErrorBoundary`, avec « Reessayer » (voir data-et-etat.md). Apres un echec d'import de la page (`isDynamicImportError`, `dynamicImportError.ts`), « Reessayer » recharge la page. Une erreur qui sort des pages (gardes, restauration, navigation refusee par le routeur) affiche `RootErrorScreen`, en francais, jamais l'ecran technique de React Router : « Recharger la page » et un lien vers le Dashboard, qui rechargent tous deux l'application.
- **404** : la route `*` affiche « Page introuvable » et un lien vers le Dashboard.
- **Pages provisoires** : une page pas encore construite affiche son titre et une phrase (`PlaceholderPage`), sans faux contenu. Les liens de la Sidebar sans ecran dans l'Alpha (Catalogue, Set Progression, Pre-Gradage IA, Parametres) menent a une page provisoire, jamais a la 404.
- Dans une page, un lien interne utilise `<Link>` de React Router.

### Cadre des pages connectees (COLLR-604)

Les pages connectees sont des enfants de `ConnectedLayout`, route de mise en page placee sous `RequireAuth`. Il affiche le template `AppLayout` (Sidebar a gauche, Topbar en haut, zone de contenu `<main>` qui defile seule) autour de la page. Le cadre reste affiche pendant le chargement d'une page et sur son ecran d'erreur : seule la zone de contenu attend.

- **Titre** : chaque page appelle `usePageTitle('Ajouter une carte')`. Le titre est fourni par la page, jamais deduit du chemin ; `AppLayout` le recoit en propriete et reste un template pur. Tant que la page affichee n'a pas fourni le sien (chargement, erreur), la Topbar affiche le nom de l'application, jamais le titre de la page precedente.
- **Un seul `h1`, un seul `<main>`** : dans le cadre, le `h1` est celui de la Topbar et `<main>` celui d'`AppLayout`. Une page connectee ne les repete pas (`usePageTitle` renvoie `true` dans le cadre).
- **Topbar** : ni recherche globale (aucune fonction a brancher dans l'Alpha), ni pastille (aucune API de notifications) ; l'avatar affiche le pseudo de la session.
- **Sous le seuil desktop** (1280 px) : la Sidebar est masquee. Le bouton « Menu » de la Topbar l'ouvre par-dessus le contenu, focus sur le premier lien ; Echap la referme et rend le focus a « Menu ». Le choix d'un lien ou la sortie du focus la referment aussi ; un lien vers la page deja affichee (marque `aria-current` par la Sidebar) rend lui aussi le focus a « Menu », puisque la page ne change pas.

### Gardes et restauration de session (COLLR-700)

| Statut de la session | Page connectee (`RequireAuth`) | Page visiteur (`RedirectIfAuthenticated`) |
|---|---|---|
| `unknown` (restauration en cours) | Ecran de demarrage | Ecran de demarrage : le formulaire n'apparait jamais un instant chez un utilisateur deja connecte |
| `unknown` + `restoreError` | Ecran d'erreur avec « Reessayer » | Ecran d'erreur avec « Reessayer » |
| `anonymous` | `/connexion?redirect=<page demandee>` ; `/connexion` seul apres une deconnexion volontaire | La page |
| `authenticated` | La page | Page demandee (`redirect`), sinon Dashboard |

- Ecran d'erreur : apres un « Reessayer » qui echoue, le focus revient sur « Reessayer » (le bouton est demonte pendant l'essai) ; au premier affichage, le focus n'est pas deplace.
- C'est `RedirectIfAuthenticated` qui redirige juste apres une connexion reussie : la page de connexion ne navigue pas elle-meme.
- `redirect` n'est suivi que s'il designe une page interne (`getSafeRedirect`) : un chemin qui, resolu par `new URL` comme le ferait le navigateur, garde la meme origine (ce qui ecarte `//hote`, `/\hote` et `/<tabulation>/hote`), dont le chemin resolu ne commence pas par `//` (`/..//hote`, `/.//hote`, `/%2e%2e//hote` gardent l'origine mais deviennent `//hote`), et jamais une page visiteur, qui bouclerait. C'est le chemin resolu qui est suivi ; en dernier filet, il est relu par `new URL` et refuse s'il sortait du site.
- Session expiree en cours d'usage : redirection vers la connexion, qui affiche « Votre session a expire, reconnectez-vous. ».
- Ecran de demarrage : fond Ecrin, nom Collectionr en fondu `duration-signature`, « Connexion… » au-dela d'1 s, jamais de spinner. La page 404 n'a pas de garde.

### Liens internes en `<a href>` natif

Les composants du design system (NavItem, fil d'Ariane de Topbar, liens des formulaires) rendent des `<a href>` natifs, pour rester independants du routeur. Sans precaution, un clic rechargerait toute l'application, et donc renouvellerait la session a chaque changement de page.

`useInternalLinkNavigation()` (`internalLinks.ts`), monte une seule fois dans `RootLayout`, ecoute les clics au niveau du document et fait passer par le routeur les clics sur un lien interne. Le navigateur garde son comportement dans tous les autres cas :

| Clic | Traitement |
|---|---|
| Clic simple (bouton principal) sur un lien de la meme origine | Navigation par le routeur, sans rechargement |
| Ctrl, Cmd, Maj ou Alt + clic, autre bouton de la souris | Navigateur (nouvel onglet, nouvelle fenetre...) |
| `target` autre que `_self` | Navigateur |
| Attribut `download` | Navigateur (telechargement) |
| `rel="external"` ou lien vers une autre origine | Navigateur |
| Clic deja traite (`<Link>` de React Router) | Ignore : le routeur l'a deja pris en charge |

La decision est prise par la fonction pure `getInternalLinkPath`, testee cas par cas ; le hook ne fait que l'appliquer.

---

## Voir aussi

- [design-system.md](./design-system.md) -- Tokens visuels utilises dans les composants
- [composants.md](./composants.md) -- Conventions de creation des composants
- [conventions-code.md](./conventions-code.md) -- Regles TypeScript et nommage
- [data-et-etat.md](./data-et-etat.md) -- Zustand, TanStack Query et regles de decision
- [CONTRIBUTING.md (global)](../../CONTRIBUTING.md) -- Onboarding et workflow Git
