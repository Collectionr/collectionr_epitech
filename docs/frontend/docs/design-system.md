# Design system — Collectionr, thème Écrin

Référence : Gold Master v1.1, planche 08.1, et critères de COLLR-573 incluant les décisions PO du 16/10/2026. Mise à jour : 25/10/2026.

Cette version remplace l'ancienne charte provisoire (Inter, palette claire, avatars ronds, shimmer). La variante Papier n'est pas implémentée ici.

## Source unique et consommation

Les valeurs vivent dans `frontend/packages/shared/src/tokens/`, sous forme d'objets TypeScript `as const`, sans JSX ni dépendance à React, Tailwind ou React Native. Import applicatif :

```ts
import { colors, typography, spacing, radius, motion, opacity, breakpoints } from '@shared/tokens';
```

Les tailles/espacements sont des nombres en pixels, les durées en millisecondes, les opacités entre 0 et 1, les interlignes des ratios et les crénages des nombres en em. Les unités CSS sont ajoutées par l'adaptateur. Les graisses sont définies dans `fontWeights` puis réutilisées par les variantes, les noms des fontes natives et le mapping Tailwind.

`frontend/styles/tailwindPreset.ts` construit le mapping commun. Les configurations Tailwind du web et de NativeWind chargent ce fichier TypeScript via Jiti. Tailwind 3.4.19 est utilisé sur les deux plateformes. Le preset remplace les palettes, espacements, arrondis et typographies par défaut : pas de couleurs ou tailles concurrentes introduites par `extend`.

Exemples de classes : `bg-ecrin`, `bg-ecrin-elevated`, `text-archive`, `border-lisere`, `p-space-16`, `gap-space-8`, `rounded-card`, `rounded-none`, `aspect-card`, `opacity-disabled`, `duration-instant`, `ease-lock`.

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

Les couleurs de liséré interactif sont dérivées d'Archive et des opacités communes : `lisere-hover` (40 %) et `lisere-active` (90 %).

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

Aucun italique. Schibsted charge uniquement 400, 500, 700, 800, 900 ; Plex Mono uniquement 500, 600. Le web importe les fichiers latins `@fontsource` dans `main.tsx` : ils sont servis avec l'application, avec `font-display: swap`.

Le mobile charge les sept TTF embarqués via `expo-font` et `src/config/fonts.ts`. Malgré leur nom, les paquets `@expo-google-fonts` utilisés ici ne font aucun appel à Google Fonts : les imports ciblent les fichiers locaux par graisse. Le rendu attend le chargement ; une erreur de chargement est remontée, sans repli silencieux permanent.

React Native utilise une famille distincte par fichier/graisse. Le preset choisit cette famille pour chaque variante au lieu de demander une graisse synthétique. Pour une surcharge de graisse native, utiliser la famille correspondante exportée par `fonts.sans.native`, pas seulement `font-bold`.

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

Easing unique : `cubic-bezier(0.2,0,0,1)`. Aucun ressort, rebond, scale de pression, spinner ou shimmer générique. Les animations génériques de Tailwind sont retirées.

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

## Validation visuelle du 573 (30/10/2026)

**Bilan web — vérifications manuelles du 30/10/2026.** Vérifications manuelles dans Storybook sous Chrome et Firefox : palette, typographies, basculement à 1280 px, espacements, dimensions, états hover/active/disabled, focus clavier et réduction des animations. Aucun écart constaté.

**Bilan Android — vérifications manuelles du 30/10/2026.** Vérifications de l'écran `TokensPreviewScreen` dans Expo Go compatible SDK 57, sans écart constaté.

**Limite iOS.** Vérifications non effectuées : la version d'Expo Go disponible sur l'appareil iOS de test prend en charge le SDK 58, alors que le projet utilise le SDK 57. Cette limitation de l'environnement de test ne permet pas de conclure sur le rendu iOS. Le rendu iOS reste non vérifié ; la validation finale du reviewer, y compris l'acceptation de cette limite ou la demande de contrôles complémentaires, reste en attente.

Storybook est présent sur la branche 573 après intégration du 594. Depuis `frontend/`, lancer `npm run storybook`, puis ouvrir `Atoms/Fondations`. Les exemples sont des démonstrations des tokens, pas les atomes des tickets 569/570.

| Story | Contrôles manuels à consigner |
| --- | --- |
| Thème Écrin | Raccordement global au thème et aux fontes |
| Palette | Neuf couleurs, texte secondaire sur les deux fonds, usages Alerte/Signal/Blanc, cotes Archive ↗ et acier-texte ↘ |
| Typographie | Sept variantes, sept graisses, interlignes/crénages, chiffres alignés, uppercase ; canvas seul à 1279 puis 1280 px, puis largeur étroite |
| Dimensions | Huit espacements, ratio 63/88, rayon carte 6 px, autres formes carrées, absence d'ombre |
| États et focus clavier | Lisérés 15/40/90 %, disabled 40 %, hover/active réels ; Tab/Maj+Tab, outline Signal 1,5 px et offset 2 px sans rognage |
| Mouvement | Quatre transitions 120/180/320/400 ms, easing commun, durées calculées à 0 avec reduced motion ; changement de préférence sans rechargement |

Exécuter la matrice dans Chrome et Firefox. Vérifier le chargement local des fontes, `font-display: swap` et les familles réellement rendues dans les outils du navigateur. Pour chaque résultat, noter le commit, navigateur/version, largeur du canvas, préférence de mouvement et éventuelle anomalie ; conserver les captures pertinentes. Une story présente n'est pas un contrôle réussi, et une capture fixe ne valide pas une transition.

Le rendu Android/iOS n'est pas couvert par ces stories web. L'écran `TokensPreviewScreen` s'affiche désormais automatiquement en développement : depuis `frontend/`, lancer `npm run dev:mobile`, puis ouvrir l'application dans Expo Go compatible SDK 57. Il présente les fontes, couleurs, dimensions, états, un champ et un bouton pour le focus avec clavier externe, les quatre transitions NativeWind et une transition Reanimated. Pour la réduction des animations, changer la préférence système puis revenir dans l'application et actionner les deux démonstrations, sans recharger. Les dimensions natives sont exprimées en unités logiques (dp), pas en pixels physiques. L'écran d'accueil minimal reste utilisé hors développement.

Cet écran est implémenté et les vérifications manuelles Android sont réussies (bilan ci-dessus). Les contrôles iOS restent non effectués. L'acceptation par le reviewer est une étape séparée.

## Historique de vérification et extension

Au 25/10/2026, les contrôles automatisés ont réussi et Lionel a lancé les versions web sur PC et mobile sur Android avec Expo Go SDK 57. Les écrans actuels affichent uniquement Collectionr avec les styles de base : ce démarrage ne constitue pas une validation visuelle exhaustive des tokens. Cette validation reste en attente de Storybook (COLLR-594), non installé, ou d'un écran de démonstration dédié, non créé. Les variantes typographiques, espacements, états, breakpoints, focus et animations restent à examiner visuellement ; le rendu natif devra être vérifié séparément du web. iOS n'a pas été testé.

Depuis `frontend/` : `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, `npm run build`. Export Android : `npm run export -w @collectionr/mobile -- --platform android`.

Les tests dans `styles/tailwindPreset.test.ts` compilent les configurations réelles web/mobile et vérifient le raccordement, le responsive, le focus (y compris sa conversion en propriétés natives) et les transitions natives, notamment reduced motion. `MotionAccessibility.test.tsx` vérifie la synchronisation avec Reanimated au démarrage et après un changement système, les erreurs et une réponse initiale tardive. Ils ne recopient pas une table de valeurs statiques. La compilation et les tests ne remplacent pas une validation visuelle sur appareil avec clavier externe.

Pour ajouter un token : définir sa valeur et son usage dans le fichier partagé approprié, adapter le mapping si nécessaire et actualiser ce document. Aucun token arbitraire ajouté dans un composant. Storybook et les atomes restent des tickets séparés (594, 569, 570).
