# Documentation Métier — Base de données TCG App

> Ce document explique le fonctionnement de la base de données d'un point de vue métier.
> Il s'adresse aussi bien aux développeurs de l'équipe qu'aux nouveaux arrivants.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Domaines métier](#domaines-métier)
   - [Catalogue de cartes](#catalogue-de-cartes)
   - [Utilisateurs & Accès](#utilisateurs--accès)
   - [Collections](#collections)
   - [Cotation & Prix](#cotation--prix)
   - [Scan & Grading](#scan--grading)
   - [Wishlist](#wishlist)
   - [Audit](#audit)
3. [Règle transversale — cardId / variantId](#règle-transversale--cardid--variantid)

---

## Vue d'ensemble

L'application permet à des collectionneurs de cartes à collectionner (TCG) de :
- **Gérer leur collection** de cartes avec suivi de valeur dans le temps
- **Scanner et noter** l'état physique de leurs cartes (grading)
- **Suivre les prix** du marché via plusieurs sources externes
- **Constituer une wishlist** des cartes qu'ils souhaitent acquérir

---

## Domaines métier

### Catalogue de cartes

Le catalogue est la colonne vertébrale de l'application. Il est organisé hiérarchiquement :

```
Licence TCG  →  Set (extension)  →  Carte  →  Variante
ex: Pokémon  →  Écarlate & Violet →  Pikachu →  Holo Rare
```

**`LICENCE_TCG`** — Représente un jeu de cartes (Pokémon, Magic: The Gathering, Yu-Gi-Oh!...). Identifié par son `slug` (`pokemon`) ; `logoUrl` est l'URL de son logo.

**`SET`** — Une extension ou édition d'une licence. Les champs `officialCardCount` (cartes imprimées, ex: 189) et `totalCardCount` (avec les cartes secrètes, ex: 201) permettent de suivre la complétude d'une collection (ex: "j'ai 45/201 cartes de ce set"). Le nom existe en anglais (`nameEn`) et en français (`nameFr`). Un set appartient à une série (`serieNameEn`/`serieNameFr`, ex: « Épée et Bouclier »), porte une abréviation officielle (`abbreviationOfficial`, ex: `DAA`, et `abbreviationFr` quand elle diffère : `TEM`), le code Pokémon TCG Online (`tcgOnlineCode`) et le nombre d'impressions par type (`normalCardCount`, `reverseCardCount`, `holoCardCount`, `firstEditionCardCount`).

**`CARD`** — Une carte individuelle dans un set. Elle porte :
- Des infos descriptives, en anglais et en français (`nameEn`/`nameFr`, `rarityEn`/`rarityFr`, `typesEn`/`typesFr`), ainsi que `number`, `hp` et `illustrator`
- Des infos de jeu : `dexIds` (numéros du Pokédex national : relie toutes les cartes d'un même Pokémon), `evolveFromEn`/`evolveFromFr` (l'évolution précédente), `stageEn`/`stageFr` (Base, Niveau 1, VMAX…), `suffix` (V, ex…), `trainerTypeEn`/`trainerTypeFr` (Objet, Supporter, Stade, Outil) et `energyTypeEn`/`energyTypeFr` (de base ou spécial)
- `tcgdexUpdatedAt` : la date de dernière modification de la fiche côté TCGdex, qui évite de retraiter les cartes inchangées
- Les URL des images du CDN TCGdex (`imageUrlEn`, `imageUrlFr`) : aucune image n'est stockée localement

L'estimation de prix d'une carte n'est pas portée par `CARD` : elle sera modélisée avec les tables de prix.

**`VARIANT`** — Une même carte peut exister en plusieurs variantes physiques : normale, holographique, reverse holo, first edition, etc. Chaque variante est décrite par des codes (`type`, `subtype` comme `shadowless`, `stamps` comme `1st-edition`, `foil`, `size`) et par les identifiants du produit chez Cardmarket, TCGPlayer et CardTrader, qui serviront à rattacher les prix. Elle a son propre historique de prix. Une impression se repère par la carte **et** le `variantId` TCGdex : cet identifiant est partagé par de nombreuses cartes. TCGdex ne fournit pas d'image par variante : l'image est celle de la carte.

---

### Utilisateurs & Accès

**`USER`** — Compte utilisateur de la plateforme. Le champ `email` est unique. Le champ `isActive` permet de désactiver un compte sans le supprimer définitivement.

**`ROLE`** — Système de rôles : `USER`, `ADMIN` (noms en majuscules, cf. `docs/security/S03-api-security.md` §5.2). Le rôle `MODERATOR` n'est pas créé pour l'instant : son périmètre sera défini avec le back-office d'administration (COLLR-679).

**`PERMISSION`** — Permission accordée à un rôle (ex: `collection:write`, `card:delete`).

**`ROLE_PERMISSION`** — Table de jointure entre `ROLE` et `PERMISSION`. Un rôle peut avoir plusieurs permissions, une permission peut être assignée à plusieurs rôles.

**`SESSION`** — Gère l'authentification utilisateur. Chaque session enregistre l'IP du client et peut être révoquée individuellement (`isRevoked`), ce qui permet de déconnecter un appareil spécifique en cas de compromission.

---

### Collections

**`COLLECTION`** — Un utilisateur peut avoir plusieurs collections (ex: "Ma collection Pokémon", "Cartes à vendre"). Une collection est rattachée à une licence (`LICENCE_TCG`). Le set d'appartenance des cartes est déductible via `COLLECTIONITEM → CARD → SET`, il n'est donc pas stocké directement sur la collection.

**`COLLECTIONITEM`** — Représente **une carte physique** dans une collection. Elle porte :
- Une carte (`cardId`) — obligatoire
- Une variante (`variantId`) — optionnelle, car toutes les cartes n'ont pas de variante
- Un état physique (`condition`) : NM (Near Mint), LP (Lightly Played), MP (Moderately Played), HP (Heavily Played), DMG (Damaged)
- Un lien optionnel vers un résultat de grading (`gradingResultId`)

**`COLLECTIONVALUEHISTORY`** — Snapshot de la valeur totale d'une collection à un instant T. Un snapshot est créé chaque matin en même temps que la mise à jour des prix du marché. Permet d'afficher une courbe d'évolution de la valeur du portefeuille de l'utilisateur.

---

### Cotation & Prix

**`DATASOURCE`** — Source de données externe pour les prix (ex: Cardmarket, eBay, TCGPlayer). Le flag `isActive` permet de désactiver une source sans la supprimer.

**`CARDPRICE`** — Prix d'une carte pour une source (`sourceId`) et une condition données. Fonctionne sur deux niveaux :
- **Prix carte** : `cardId` renseigné, `variantId` optionnel — prix de base de la carte (ex: Dracaufeu = 50€)
- **Prix variante** : `cardId` + `variantId` renseignés — prix spécifique à la variante (ex: Dracaufeu Holo = 500€)

Cela permet de comparer les prix entre plateformes et d'alimenter l'estimation de prix de la carte.

**`PRICEHISTORY`** — Historique des valeurs prises par une entrée `CARDPRICE` dans le temps. Chaque mise à jour de prix crée une nouvelle ligne (`cardPriceId` + `recordedAt`), ce qui permet d'afficher l'évolution du prix dans le temps.

---

### Scan & Grading

C'est la fonctionnalité différenciante de l'application : permettre à un utilisateur de **photographier ses cartes** pour les identifier et évaluer leur état automatiquement.

**`SCANHISTORY`** — Enregistre chaque scan effectué. Un scan peut détecter plusieurs cartes à la fois (`detectedCount`, `detectedCards` via une structure de données permettant de stocker des informations flexibles). Le champ `status` permet de suivre le traitement du scan (en cours, terminé, erreur).

**`GRADINGRESULT`** — Résultat détaillé de l'évaluation d'une carte, produit à partir d'un scan. Comme pour `COLLECTIONITEM`, `cardId` est obligatoire et `variantId` optionnelle. Le score final est décomposé en 4 critères physiques :

| Critère | Description |
|---------|-------------|
| `centeringScore` | Centrage de l'image par rapport aux bords |
| `cornersScore` | État des coins (usure, pliures) |
| `edgesScore` | État des bords (accrocs, égratignures) |
| `surfaceScore` | État de la surface (rayures, brillance) |

Le champ `modelVersion` permet de tracer quelle version du modèle IA a produit le résultat, utile pour les réanalyses en cas de mise à jour du modèle.

---

### Wishlist

**`WISHLIST`** — Liste de cartes qu'un utilisateur souhaite acquérir. Chaque entrée cible une carte (`cardId` obligatoire) et optionnellement une variante précise (`variantId` optionnelle). Le champ `priority` permet de trier les entrées par importance (ex: haute, moyenne, basse).

---

### Audit

**`AUDITLOG`** — Journal de toutes les actions significatives effectuées sur la plateforme. Permet de :
- Déboguer des comportements inattendus
- Détecter des activités suspectes
- Respecter des exigences de conformité (RGPD, etc.)

Le champ `metadata` stocke le contexte de l'action (ex: les valeurs avant/après une modification). Les champs `targetType` et `targetId` identifient l'entité concernée par l'action. Ces logs sont accessibles uniquement aux utilisateurs autorisés.

---

## Règle transversale — cardId / variantId

Une règle s'applique de manière uniforme sur toutes les tables qui référencent des cartes (`PRICEHISTORY`, `COLLECTIONITEM`, `GRADINGRESULT`, `WISHLIST`) :

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `cardId` |  Toujours | Toute entrée est au minimum liée à une carte |
| `variantId` |  Optionnelle | Renseignée uniquement si la variante est connue et pertinente |

> Quand `variantId` est renseigné, `cardId` l'est forcément aussi — la variante appartient toujours à une carte.
