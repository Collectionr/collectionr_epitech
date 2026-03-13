# Documentation Métier — Base de données TCG App

> Ce document explique le fonctionnement de la base de données d'un point de vue métier.
> Il s'adresse aussi bien aux développeurs de l'équipe qu'aux nouveaux arrivants.

---

## Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Domaines métier](#domaines-métier)
   - [Catalogue de cartes](#-catalogue-de-cartes)
   - [Utilisateurs & Accès](#-utilisateurs--accès)
   - [Collections](#-collections)
   - [Cotation & Prix](#-cotation--prix)
   - [Scan & Grading](#-scan--grading)
   - [Wishlist](#-wishlist)
   - [Audit](#-audit)
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

###  Catalogue de cartes

Le catalogue est la colonne vertébrale de l'application. Il est organisé hiérarchiquement :

```
Licence TCG  →  Set (extension)  →  Carte  →  Variante
ex: Pokémon  →  Écarlate & Violet →  Pikachu →  Holo Rare
```

**`LICENCE_TCG`** — Représente un jeu de cartes (Pokémon, Magic: The Gathering, Yu-Gi-Oh!...). Le champ `slug` permet de générer des URLs propres (ex: `/pokemon`, `/magic`).

**`SET`** — Une extension ou édition d'une licence. Le champ `totalCards` permet de suivre la complétude d'une collection (ex: "j'ai 45/200 cartes de ce set").

**`CARD`** — Une carte individuelle dans un set. Elle porte :
- Des infos descriptives (`name`, `number`, `rarity`, `types`, `hp`)
- Une **estimation de prix** calculée (`predictedPrice`, `priceLowerBound`, `priceUpperBound`), issue d'un algorithme basé sur l'historique des prix

**`VARIANT`** — Une même carte peut exister en plusieurs variantes physiques : normale, holographique, reverse holo, first edition, etc. Chaque variante a sa propre image et son propre historique de prix. Toutes les cartes n'ont pas forcément de variante.

---

###  Utilisateurs & Accès

**`USER`** — Compte utilisateur de la plateforme. Le champ `email` est unique. Le champ `isActive` permet de désactiver un compte sans le supprimer (soft delete).

**`ROLE`** — Système de rôles (ex: `admin`, `user`, `moderator`).

**`PERMISSION`** — Permission atomique accordée à un rôle (ex: `collection:write`, `card:delete`).

**`ROLE_PERMISSION`** — Table de jointure entre `ROLE` et `PERMISSION`. Un rôle peut avoir plusieurs permissions, une permission peut être assignée à plusieurs rôles.

**`SESSION`** — Gère l'authentification via un système de **refresh token** (JWT ou similaire). Chaque session enregistre l'IP du client et peut être révoquée individuellement (`isRevoked`), ce qui permet de déconnecter un appareil spécifique en cas de compromission.

---

###  Collections

**`COLLECTION`** — Un utilisateur peut avoir plusieurs collections (ex: "Ma collection Pokémon", "Cartes à vendre"). Une collection est rattachée à une licence TCG. Le set d'appartenance des cartes est déductible via `COLLECTIONITEM → CARD → SET`, il n'est donc pas stocké directement sur la collection.

**`COLLECTIONITEM`** — Représente **une carte physique** dans une collection. Elle porte :
- Une carte (`cardId`) — obligatoire
- Une variante (`variantId`) — nullable, car toutes les cartes n'ont pas de variante
- Un état physique (`condition`) : NM (Near Mint), LP (Lightly Played), MP, HP, DMG
- Un lien optionnel vers un résultat de grading (`gradingResultId`)

**`COLLECTIONVALUEHISTORY`** — Snapshot de la valeur totale d'une collection à un instant T. Permet d'afficher une courbe d'évolution de la valeur du portefeuille de l'utilisateur.

---

###  Cotation & Prix

**`DATASOURCE`** — Source de données externe pour les prix (ex: Cardmarket, eBay, TCGPlayer). Le flag `isActive` permet de désactiver une source sans la supprimer.

**`PRICEHISTORY`** — Historique des prix par source et par condition. Fonctionne sur deux niveaux :
- **Prix carte** : `cardId` renseigné, `variantId` null → prix de base de la carte (ex: Dracaufeu = 50€)
- **Prix variante** : `cardId` + `variantId` renseignés → prix spécifique à la variante (ex: Dracaufeu Holo = 500€)

Cela permet de comparer les prix entre plateformes, d'afficher l'évolution dans le temps, et d'alimenter l'algorithme de prédiction de `CARD`.

---

###  Scan & Grading

C'est la fonctionnalité différenciante de l'application : permettre à un utilisateur de **photographier ses cartes** pour les identifier et évaluer leur état automatiquement.

**`SCANHISTORY`** — Enregistre chaque scan effectué. Un scan peut détecter plusieurs cartes à la fois (`detectedCount`, `detectedCards` en JSON). Le champ `status` permet de suivre le traitement asynchrone (en cours, terminé, erreur).

**`GRADINGRESULT`** — Résultat détaillé de l'évaluation d'une carte, produit à partir d'un scan. Comme pour `COLLECTIONITEM`, `cardId` est obligatoire et `variantId` nullable. Le score final est décomposé en 4 critères physiques :

| Critère | Description |
|---------|-------------|
| `centeringScore` | Centrage de l'image par rapport aux bords |
| `cornersScore` | État des coins (usure, pliures) |
| `edgesScore` | État des bords (accrocs, égratignures) |
| `surfaceScore` | État de la surface (rayures, brillance) |

Le champ `modelVersion` permet de tracer quelle version du modèle IA a produit le résultat, utile pour les réanalyses en cas de mise à jour du modèle.

---

###  Wishlist

**`WISHLIST`** — Liste de cartes qu'un utilisateur souhaite acquérir. Chaque entrée cible une carte (`cardId` obligatoire) et optionnellement une variante précise (`variantId` nullable). Le champ `priority` permet de trier les entrées par importance (ex: haute, moyenne, basse).

---

###  Audit

**`AUDITLOG`** — Journal de toutes les actions significatives effectuées sur la plateforme. Permet de :
- Déboguer des comportements inattendus
- Détecter des activités suspectes
- Respecter des exigences de conformité (RGPD, etc.)

Le champ `metadata` en JSON stocke le contexte de l'action (ex: les valeurs avant/après une modification). Les champs `targetType` et `targetId` identifient l'entité concernée par l'action.

---

## Règle transversale — cardId / variantId

Une règle s'applique de manière uniforme sur toutes les tables qui référencent des cartes (`PRICEHISTORY`, `COLLECTIONITEM`, `GRADINGRESULT`, `WISHLIST`) :

| Champ | Obligatoire | Description |
|-------|-------------|-------------|
| `cardId` |  Toujours | Toute entrée est au minimum liée à une carte |
| `variantId` |  Nullable | Renseigné uniquement si la variante est connue et pertinente |

> Quand `variantId` est renseigné, `cardId` l'est forcément aussi — la variante appartient toujours à une carte.