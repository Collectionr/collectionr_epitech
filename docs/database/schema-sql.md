# Schéma DB — TCG App

## Diagramme

```mermaid
erDiagram
    GAME ||--o{ SET : contains
    SET ||--o{ CARD : contains
    CARD ||--o{ VARIANT : has
    CARD ||--o{ CARDPRICE : "has price"
    DATASOURCE ||--o{ CARDPRICE : provides
    CARDPRICE ||--o{ PRICEHISTORY : "has history"
    ROLE ||--o{ ROLE_PERMISSION : has
    PERMISSION ||--o{ ROLE_PERMISSION : "assigned to"
    ROLE ||--o{ USER : assigned_to
    VARIANT ||--o{ CARDPRICE : "has price"
    USER ||--o{ SESSION : has
    USER ||--o{ COLLECTION : creates
    USER ||--o{ AUDITLOG : performs
    USER ||--o{ SCANHISTORY : triggers
    USER ||--o{ WISHLIST : "listed in"
    USER ||--o{ CONSENT : grants
    COLLECTION ||--o{ COLLECTIONITEM : includes
    COLLECTION ||--o{ COLLECTIONVALUEHISTORY : "tracks value"
    CARD ||--o{ COLLECTIONITEM : "is in"
    VARIANT ||--o{ COLLECTIONITEM : uses
    VARIANT ||--o{ WISHLIST : "listed in"
    CARD ||--o{ WISHLIST : "listed in"
    SCANHISTORY ||--o{ GRADINGRESULT : produces
    GRADINGRESULT ||--o{ COLLECTIONITEM : "graded by"
    CARD ||--o{ GRADINGRESULT : "graded"
    CARD ||--o{ SCRAPELOG : "scrape logs"

    GAME {
        uuid id PK
        string slug UK
        string name
        datetime createdAt
        datetime updatedAt
    }

    ROLE {
        uuid id PK
        string name
    }

    PERMISSION {
        uuid id PK
        string name
    }

    ROLE_PERMISSION {
        uuid roleId FK
        uuid permissionId FK
    }

    USER {
        uuid id PK
        string email UK
        string passwordHash
        string username
        uuid roleId FK
        boolean isActive
        string locale
        datetime termsAcceptedAt
        string termsVersion
        datetime lastLoginAt
        datetime createdAt
        datetime deletedAt
        boolean isAnonymized
    }

    CONSENT {
        uuid id PK
        uuid userId FK
        string type
        boolean granted
        datetime grantedAt
        datetime revokedAt
        string ipAddress
    }

    SESSION {
        uuid id PK
        uuid userId FK
        string refreshToken
        string ipAddress
        boolean isRevoked
        datetime expiresAt
    }

    SET {
        uuid id PK
        uuid gameId FK
        string tcgdexId UK
        string nameEn
        string nameFr "nullable"
        string serieTcgdexId "nullable"
        string serieNameEn "nullable"
        string serieNameFr "nullable"
        date releaseDate "nullable"
        string abbreviationOfficial "nullable"
        string abbreviationFr "nullable"
        string tcgOnlineCode "nullable"
        int officialCardCount
        int totalCardCount
        int normalCardCount "nullable"
        int reverseCardCount "nullable"
        int holoCardCount "nullable"
        int firstEditionCardCount "nullable"
        boolean legalStandard "nullable"
        boolean legalExpanded "nullable"
        string logoUrlEn "nullable"
        string logoUrlFr "nullable"
        string symbolUrl "nullable"
        datetime createdAt
        datetime updatedAt
    }

    CARD {
        uuid id PK
        uuid setId FK
        string tcgdexId UK
        string number
        string nameEn
        string nameFr "nullable"
        string categoryEn
        string categoryFr "nullable"
        string rarityEn "nullable"
        string rarityFr "nullable"
        string illustrator "nullable"
        int hp "nullable"
        string[] typesEn
        string[] typesFr
        int[] dexIds
        string evolveFromEn "nullable"
        string evolveFromFr "nullable"
        string stageEn "nullable"
        string stageFr "nullable"
        string suffix "nullable"
        string trainerTypeEn "nullable"
        string trainerTypeFr "nullable"
        string energyTypeEn "nullable"
        string energyTypeFr "nullable"
        string regulationMark "nullable"
        boolean legalStandard "nullable"
        boolean legalExpanded "nullable"
        boolean hasNormal
        boolean hasReverse
        boolean hasHolo
        boolean hasFirstEdition
        boolean hasWPromo
        datetime tcgdexUpdatedAt "nullable"
        string imageUrlEn "nullable"
        string imageUrlFr "nullable"
        datetime createdAt
        datetime updatedAt
    }

    VARIANT {
        uuid id PK
        uuid cardId FK
        string tcgdexVariantId "UK avec cardId"
        string type
        string subtype "nullable"
        string size
        string[] stamps
        string foil "nullable"
        int cardmarketProductId "nullable"
        int tcgplayerProductId "nullable"
        int cardtraderProductId "nullable"
        datetime createdAt
        datetime updatedAt
    }

    DATASOURCE {
        uuid id PK
        string name
        string baseUri
        boolean isActive
    }

    CARDPRICE {
        uuid id PK
        uuid cardId FK
        uuid variantId FK "nullable"
        uuid sourceId FK
        enum condition
        float price
        string currency
        datetime recordedAt
    }

    PRICEHISTORY {
        uuid id PK
        uuid cardPriceId FK
        datetime recordedAt
    }

    COLLECTION {
        uuid id PK
        uuid userId FK
        uuid gameId FK
        string name
        datetime createdAt
    }

    COLLECTIONITEM {
        uuid id PK
        uuid collectionId FK
        uuid cardId FK
        uuid variantId FK "nullable"
        uuid gradingResultId FK
        enum condition
    }

    COLLECTIONVALUEHISTORY {
        uuid id PK
        uuid collectionId FK
        float totalValue
        string currency
        datetime timestamp
    }

    WISHLIST {
        uuid id PK
        uuid userId FK
        uuid cardId FK
        uuid variantId FK "nullable"
        string priority
        datetime addedAt
    }

    SCANHISTORY {
        uuid id PK
        uuid userId FK
        string type
        string imageHash
        int detectedCount
        json detectedCards
        string status
        datetime createdAt
    }

    GRADINGRESULT {
        uuid id PK
        uuid cardId FK
        uuid userId FK
        uuid scanHistoryId FK
        float score
        float centeringScore
        float cornersScore
        float edgesScore
        float surfaceScore
        string description
        string modelVersion
        datetime createdAt
    }

    AUDITLOG {
        uuid id PK
        uuid userId FK
        string action
        string targetType
        uuid targetId
        json metadata
        datetime timestamp
        datetime expiresAt
    }

    SCRAPELOG {
        uuid id PK
        uuid cardId FK
        string source
        string status
        string errorMsg
        datetime startedAt
        datetime finishedAt
    }

    DATARETENTIONPOLICY {
        uuid id PK
        string entityType
        int retentionDays
        string description
        datetime updatedAt
    }
```

## Catalogue des cartes : contrat d'interface (COLLR-684)

`GAME`, `SET`, `CARD` et `VARIANT` sont possédées et migrées par le backend (Prisma, tables `games`, `sets`, `cards`, `variants` ; le modèle Prisma de `SET` s'appelle `CardSet` pour ne pas masquer le `Set` de JavaScript). Le microservice TCG ne crée ni ne modifie aucune de ces tables : il y écrit uniquement par UPSERT, sur les clés uniques ci-dessous. Détails et décisions : ADR-015 dans `.claude/contexts/architecture.md`.

| Table | Clé de l'UPSERT | Exemple |
|-------|-----------------|---------|
| `games` | `slug` | `pokemon` |
| `sets` | `tcgdexId` | `base1`, `swsh3`, `sv03.5` |
| `cards` | `tcgdexId` | `swsh3-20`, `sv03.5-006` |
| `variants` | `(cardId, tcgdexVariantId)` | `(<id de base1-4>, 4ffrmhcfiaejakhepqdkx7o)` |

- **Identifiants** : `tcgdexId` est l'identifiant TCGdex tel quel, identique en français et en anglais ; il sert de clé de jointure entre les deux langues. `number` est le `localId` TCGdex, en texte (zéros initiaux : `006`). L'`id` UUID est généré par la base (`DEFAULT gen_random_uuid()`) : un INSERT en SQL brut n'a pas à le fournir.
- **`variantId` de TCGdex n'est pas unique à lui seul** : il identifie un *type* d'impression (par exemple « holo, sans ombre, 1re édition ») et se retrouve sur beaucoup de cartes (les 16 premières cartes de `base1` portent les mêmes quatre). Une impression se repère donc par la carte **et** son `variantId`.
- **Français / anglais** : une seule ligne par set et par carte, avec des colonnes `…En` et `…Fr` pour tout ce que TCGdex traduit (noms, catégorie, rareté, types, stade, type de Dresseur et d'Énergie, nom de l'évolution précédente, série, abréviation du set). L'anglais est la référence (obligatoire) ; le français est optionnel car TCGdex ne le couvre qu'à environ 95 %. Les raretés ne sont pas toutes traduites par TCGdex (`Common` / `Commune`, mais `Holo Rare` dans les deux langues) : on stocke ce qu'il renvoie. Les nombres, drapeaux, codes et identifiants (PV, numéros de Pokédex, légalité, `regulationMark`, `suffix`…) sont lus dans la réponse anglaise.
- **Variantes** : les codes (`type`, `subtype`, `size`, `stamps`, `foil`) sont stockés en anglais seulement ; les libellés français de TCGdex sont en partie non traduits (`thank-you`, `pikachu`) et se rendent côté interface. `cards.hasNormal`, `hasReverse`, `hasHolo`, `hasFirstEdition`, `hasWPromo` résument les types d'impression d'une carte ; le détail est dans `variants`.
- **Images** : seules les URL de base du CDN TCGdex sont stockées, sans extension (on ajoute `/high.webp` à l'affichage). Aucune image n'est stockée localement.
- **`updatedAt`** : maintenu par Prisma pour ses propres écritures seulement. Un UPSERT en SQL brut (psycopg) doit le renseigner (`updatedAt = now()`). `cards.tcgdexUpdatedAt` est une autre date : le `updated` de TCGdex, qui permet de ne retraiter que les cartes modifiées.
- **Hors contrat** : prix, prédictions, et le détail de jeu des cartes (attaques, talents, faiblesses, résistances, coût de retraite, description, effet). Les champs `predictedPrice`, `priceLowerBound` et `priceUpperBound` de l'ancienne `CARD` sont retirés : ils appartiennent au worker de prédiction et n'ont pas encore de ticket backend. Les anciens champs `label` et `imageUrl` de `VARIANT` disparaissent aussi : TCGdex ne donne pas d'image par variante, et `type` / `subtype` / `stamps` / `foil` remplacent le libellé.
