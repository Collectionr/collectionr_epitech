> **Maintenu par :** François Dubois (PO / Frontend Lead)
> **Dernière mise à jour :** 2026-11-06
> **Audience :** Toute l’équipe, en particulier les nouveaux contributeurs

# Design system — Collectionr, thème Écrin

Référence : Gold Master v1.1, planche 08.1, et critères de COLLR-573 incluant les décisions PO du 16/10/2026.

Cette version remplace l'ancienne charte provisoire (Inter, palette claire, avatars ronds, shimmer). La variante Papier n'est pas implémentée ici.

## Source unique et consommation

Les valeurs vivent dans `frontend/packages/shared/src/tokens/`, sous forme d'objets TypeScript `as const`, sans JSX ni dépendance à React, Tailwind ou React Native. Import applicatif :

```ts
import { colors, typography, spacing, radius, motion, opacity, breakpoints } from '@shared/tokens';
```

Les tailles/espacements sont des nombres en pixels, les durées en millisecondes, les opacités entre 0 et 1, les interlignes des ratios et les crénages des nombres en em. Les unités CSS sont ajoutées par l'adaptateur. Les graisses sont définies dans `fontWeights` puis réutilisées par les variantes, les noms des fontes natives et le mapping Tailwind.

`frontend/styles/tailwindPreset.ts` construit le mapping commun. Les configurations Tailwind du web et de NativeWind chargent ce fichier TypeScript via Jiti. Tailwind 3.4.19 est utilisé sur les deux plateformes. Le preset remplace les palettes, espacements, arrondis et typographies par défaut : pas de couleurs ou tailles concurrentes introduites par `extend`.

Exemples de classes : `bg-ecrin`, `bg-ecrin-elevated`, `text-archive`, `border-lisere`, `p-space-16`, `gap-space-8`, `rounded-card`, `rounded-none`, `aspect-card`, `opacity-disabled`, `duration-instant`.

Les classes `text-display`, `text-h1`, `text-h2`, `text-body`, `text-caption`, `text-data` et `text-button-label` appliquent la famille, la taille, l'interligne, le crénage et la graisse ensemble. Les futurs composants passent par l'atome Text, sauf Button qui utilise directement `text-button-label`. Les écrans de démarrage utilisent provisoirement ces classes en attendant Text (COLLR-575).

## Couleurs

| Token | Valeur | Usage |
| --- | --- | --- |
| ecrin | #0C0E12 | Fond dominant, environ 70 % |
| ecrin-elevated | #12151B | Panneaux, surfaces et champs |
| archive | #E6E4DC | Texte principal, structure, environ 25 % |
| signal | #2E4BFF | Identité, réticules, CTA, grades IA, 5 % maximum |
| acier | #6E727A | Décoration uniquement, jamais du texte |
| acier-texte | #8A8F98 | Texte secondaire et bordures de contrôles |
| alerte | #E5484D | Erreurs et actions destructrices irréversibles |
| blanc | #FFFFFF | Print / slab |
| lisere | rgba(230,228,220,0.15) | Bordure fine des cartes |

Signal ne porte aucun texte inférieur à 18 px sur Écrin et ne sert jamais aux cotes. Les contrôles utilisent acier-texte pour leur bordure, pas le liséré faible d'une carte. Pas d'ombre sur fond sombre.

Les couleurs de liséré sont dérivées d'Archive et des opacités communes : `lisere` (15 %), `lisere-hover` (40 %) et `lisere-active` (90 %).

## Typographie et polices locales

| Variante | Taille | Interligne | Crénage | Famille / graisse |
| --- | --- | --- | --- | --- |
| display | 96 px, 48 sous 1280 px | 1 | -0,03 em | Schibsted 900 |
| h1 | 56 px, 36 sous 1280 px | 1,07 | -0,02 em | Schibsted 700 |
| h2 | 32 px | 1,19 | -0,01 em | Schibsted 700 |
| body | 16 px | 26 px | 0 | Schibsted 400 |
| caption | 12 px | 16 px | +0,02 em | Schibsted 500 |
| data | 14 px | 20 px | +0,01 em | Plex Mono 500 |
| button-label | 14 px | Non spécifié : aucun token ni style d'interligne ajouté | +0,14 em | Plex Mono 600, uppercase |

Aucun italique. Schibsted charge uniquement 400, 500, 700, 800, 900 ; Plex Mono uniquement 500, 600. Le web importe les fichiers latins `@fontsource` via `src/styles/fonts.ts` : ils sont servis avec l'application, avec `font-display: swap`. Les piles de repli sont centralisées dans `fonts` : `ui-sans-serif, system-ui, sans-serif` pour Schibsted et `ui-monospace, monospace` pour Plex Mono.

Le mobile charge les sept TTF embarqués via `expo-font` et `src/config/fonts.ts`. Malgré leur nom, les paquets `@expo-google-fonts` utilisés ici ne font aucun appel à Google Fonts : les imports ciblent les fichiers locaux par graisse. Le splash reste affiché pendant le chargement. En cas d’échec, il laisse place à un message en police système invitant à relancer l’application, sans utiliser les familles indisponibles.

React Native utilise une famille distincte par fichier/graisse. Le preset choisit cette famille pour chaque variante au lieu de demander une graisse synthétique. Pour une surcharge, utiliser les classes communes `font-sans-normal`, `font-sans-medium`, `font-sans-bold`, `font-sans-extrabold`, `font-sans-black`, `font-mono-medium` ou `font-mono-semibold` (réservée à Button). Elles sélectionnent le fichier natif ou la famille et la graisse web. Les utilitaires génériques de graisse (`font-bold`, etc.) ne sont pas générés en natif.

Data-Mono sert aux prix, grades, quantités, identifiants et timestamps. Le web applique `font-variant-numeric: tabular-nums`. Sur mobile, IBM Plex Mono fournit naturellement des chiffres de largeur identique ; NativeWind 4 ne prend pas en charge `font-variant-numeric`.

## Dimensions et opacités

- Espacements : `space-4`, `space-8`, `space-12`, `space-16`, `space-24`, `space-32`, `space-48`, `space-64`.
- Arrondis : `radius.card` = 6 px, `radius.none` = 0. Avatar et Badge sont carrés ; pas de `rounded-full`.
- Ratio : `aspectRatio.card` = 63/88.
- Bordure fine : `borders.thin` = 1 px.
- Disabled : `opacity.disabled` = 0,4.
- Seuil desktop : `breakpoints.desktop` = 1280 px. Les variantes display/h1 basculent automatiquement à ce seuil.

## Mouvement et focus

| Durée | Valeur | Usage |
| --- | --- | --- |
| instant | 120 ms | Hover, liséré, focus |
| snap | 180 ms | Verrouillage, toggle, coche |
| signature | 320 ms | Entrée de réticule, logo |
| sequence | 400 ms | Balayage multi-cibles |

Easing unique : `motion.easing` est le tuple `[0.2, 0, 0, 1]`. Le preset le convertit en `cubic-bezier(0.2,0,0,1)` ; Reanimated utilise `Easing.bezier(...motion.easing)`. Aucun ressort, rebond, scale de pression, spinner ou shimmer générique. Les animations génériques de Tailwind sont retirées.

Sur le web, les durées utilisent des variables CSS mises à zéro dans `prefers-reduced-motion: reduce`. Une animation CSS spécifique doit également utiliser `var(--duration-...)`. Sur mobile, le preset produit les surcharges de durée à zéro pour les classes de transition et de durée, via la même media query reconnue par NativeWind (AccessibilityInfo).

`MotionAccessibility`, monté une fois dans `App.tsx`, synchronise également la préférence système avec la configuration globale de Reanimated, pour les animations programmées directement. Il suit les changements pendant l'utilisation, ignore une lecture initiale devenue obsolète et désactive les animations si cette lecture échoue. Les animations de l'application utilisent NativeWind ou Reanimated, avec les tokens de durée ; ne pas contourner cette configuration avec une surcharge locale `ReduceMotion.Never` ou un autre moteur d'animation.

Focus web global sur `:focus-visible` : outline 1,5 px Signal, offset 2 px, depuis `borders.focus`. Ne pas supprimer cet indicateur dans un composant. Sur mobile, les contrôles focusables portent la classe commune `focus-indicator` : le preset applique les mêmes tokens à l'état `:focus`, via les propriétés natives `outlineWidth`, `outlineOffset`, `outlineColor`, `outlineStyle`. Les propriétés outline sont disponibles dans la nouvelle architecture React Native utilisée ici. Aucun contrôle n'existe encore ; cette classe devra être ajoutée à chaque futur contrôle natif. Les valeurs et le comportement sont centralisés, pas réécrits dans chaque composant.

## Décisions PO du 16/10/2026

- Un atome peut importer uniquement Text comme autre atome.
- Button n'importe aucun atome et utilise son token typographique réservé.
- Avatar et Badge sont carrés.
- Badge : fond Archive, chiffre Écrin ; une notification ordinaire n'utilise ni Signal ni Alerte.
- Checkbox cochée : fond Archive et coche Écrin.
- Alerte est autorisé pour les actions destructrices. Button danger reste transparent, bordure/texte Alerte.
- Cotes : hausse en Archive avec ↗ ; baisse en acier-texte avec ↘. Ni rouge/vert, ni Signal.

## Icônes

Utiliser Lucide Icons (`lucide-react` / `lucide-react-native`), avec une taille explicite et un libellé accessible. Les icônes renforcent la compréhension sans remplacer le texte.

| Taille | Valeur | Usage |
| --- | --- | --- |
| Small | 16 px | Icônes inline, badges |
| Medium | 20 px | Boutons, navigation |
| Large | 24 px | Tab bar, actions principales |

## Prix et valeurs monétaires

Format : `X,XX EUR`, virgule décimale, espace pour les milliers, `EUR` après le montant (exemple : `1 234,56 EUR`). Utiliser Data-Mono. Les hausses sont en Archive avec ↗, les baisses en acier-texte avec ↘ ; ni rouge/vert, ni Signal.

## Commandes et démonstrations

Depuis `frontend/` : `npm run storybook` pour les exemples sous **Fondations / Tokens**, `npm run build-storybook` pour leur compilation.

Mobile : renseigner `EXPO_PUBLIC_TOKENS_PREVIEW=true` dans `apps/mobile/.env` et lancer `npm run dev:mobile`. Redémarrer Metro et recharger l’application après modification de cette variable. La démonstration est désactivée par défaut et exclue des exports de production, même si la variable vaut `true`. Revenir à `false` pour retrouver l’application habituelle.

Contrôles : `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`. Export Android : `npm run export -w @collectionr/mobile -- --platform android`.

## Ajouter un token

Vérifier d’abord qu’aucun token existant ne convient. Proposer tout nouveau token dans une **PR dédiée**, et non dans une PR de fonctionnalité. Définir sa valeur et son usage dans le fichier partagé approprié, adapter le mapping web/native si nécessaire et actualiser ce document. Aucun token arbitraire ajouté dans un composant.

## Voir aussi

- [composants.md](./composants.md) — Application des tokens aux composants.
- [conventions-code.md](./conventions-code.md) — Règles TypeScript et nommage.
- [data-et-etat.md](./data-et-etat.md) — Gestion d’état et data fetching.
- [architecture.md](./architecture.md) — Organisation du frontend.
