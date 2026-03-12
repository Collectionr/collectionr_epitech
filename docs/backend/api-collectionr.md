# 📘 Pokémon Card Scanner & CollectionR API

---

# 1. Vue d'ensemble

Cette API permet aux utilisateurs de :

* Scanner une carte Pokémon via la caméra de leur appareil
* Identifier automatiquement la carte
* Estimer son état (grading) grâce au Machine Learning
* Récupérer les métadonnées de la carte
* Récupérer les données de prix du marché
* Stocker les cartes dans la collection personnelle d'un utilisateur

L'architecture du système est composée de :

* **Backend TypeScript avec Fastify**
* **Microservice Python pour la vision par ordinateur**
* **Base de données PostgreSQL avec Prisma ORM**
* **Couche de cache Redis**
* **Frontend React / React Native**
* **API interne CollectionR**
* **APIs externes de données de marché**

---

# 2. Architecture système

```text
Application React / React Native
        │
        │ REST / GraphQL
        ▼
Serveur API Fastify (TypeScript)
        │
        ├── Redis (Couche Cache)
        │
        ├── Base de données PostgreSQL
        │       Prisma ORM
        │
        ├── Microservice Scanner
        │       FastAPI + OpenCV
        │
        ├── CollectionR Card API
        │       Métadonnées internes des cartes
        │
        └── Agrégateur de données de marché
                │
        ┌───────────────┬───────────────┐
        ▼               ▼               ▼
   API Cardmarket      API eBay     API TCGPlayer
```

**L'API CollectionR reste la source interne principale pour les métadonnées des cartes**, tandis que les APIs de marché fournissent les **informations de prix et l'enrichissement de données**.

---

# 3. Architecture backend

Le backend est construit avec :

* **TypeScript**
* **Fastify**
* **Prisma**
* **PostgreSQL**
* **Redis**

Structure en clean architecture :

```text
src
│
├── domain
│   ├── entities
│   │   ├── Card.ts
│   │   └── Collection.ts
│
├── application
│   ├── use-cases
│   │   ├── ScanCardUseCase.ts
│   │   ├── IdentifyCardUseCase.ts
│   │   ├── GetCardDataUseCase.ts
│   │   └── GetMarketPriceUseCase.ts
│
├── infrastructure
│   ├── database
│   │   ├── PrismaService.ts
│   │   └── schema.prisma
│   │
│   ├── cache
│   │   └── RedisService.ts
│   │
│   ├── card
│   │   └── CollectionRCardService.ts
│   │
│   ├── market
│   │   ├── EbayService.ts
│   │   ├── TcgPlayerService.ts
│   │   └── CardmarketService.ts
│   │
│   └── scanner
│       └── ScannerClient.ts
│
├── interfaces
│   ├── graphql
│   │   └── CardResolver.ts
│   │
│   └── routes
│       └── ScanRoutes.ts
│
└── Server.ts
```

---

# 4. API CollectionR

## Objectif

L'**API CollectionR** gère les **métadonnées internes des cartes TCG**.

Objectifs :

* Maintenir une **base de données interne complète des cartes TCG**
* Fournir une **source de données stable et cohérente**
* Réduire la dépendance aux APIs externes de cartes
* Permettre l'enrichissement interne avec les données de marché

Inspirée d'APIs telles que :

```
https://api.tcgdex.net/v2/en/cards/swsh3-136
```

Mais implémentée en interne.

---

## Responsabilités

L'API doit :

* Stocker les métadonnées des cartes TCG
* Récupérer les informations d'une carte
* Supporter la recherche de carte par ID
* Supporter les opérations de recherche
* Fusionner les métadonnées avec les données de marché

Les APIs externes sont utilisées **uniquement pour l'enrichissement des prix**, pas comme source principale de métadonnées.

---

# 5. Modèles de données

## Carte

```json
{
  "id": "swsh3-136",
  "name": "Dracaufeu",
  "set": {
    "id": "swsh3",
    "name": "Ténèbres Embrasées"
  },
  "number": "136",
  "rarity": "Rare Holo",
  "types": ["Feu"],
  "hp": 170,
  "image": "https://cdn.collectionr/cards/swsh3-136.png"
}
```

## Prix du marché

```json
{
  "card_id": "swsh3-136",
  "source": "ebay",
  "average_price": 45.5,
  "currency": "EUR"
}
```

---

# 6. Endpoints de l'API Carte

---

## GET /cards/:id

Récupère les métadonnées d'une carte.

```http
GET /cards/swsh3-136
```

Réponse :

```json
{
  "id": "swsh3-136",
  "name": "Dracaufeu",
  "set": "Ténèbres Embrasées",
  "rarity": "Rare Holo"
}
```

---

## GET /cards/search

Recherche des cartes par nom.

```
GET /cards/search?q=pikachu
```

---

# 7. Agrégation des données de marché

Le backend agrège les prix du marché depuis plusieurs APIs.

Sources :

* **API Cardmarket**
* **API eBay**
* **API TCGPlayer**

Le système fusionne les données pour calculer une **valeur moyenne du marché**.

---

## Exemple de requête GraphQL

```graphql
query {
  marketPrice(cardId: "swsh3-136") {
    source
    averagePrice
    currency
  }
}
```

Réponse :

```json
{
  "data": {
    "marketPrice": [
      {
        "source": "ebay",
        "averagePrice": 42
      },
      {
        "source": "cardmarket",
        "averagePrice": 39
      }
    ]
  }
}
```

---

# 8. Codes de réponse

| Code | Signification       |
|------|---------------------|
| 200  | Succès              |
| 201  | Ressource créée     |
| 400  | Requête invalide    |
| 404  | Carte introuvable   |
| 500  | Erreur serveur      |

---

# 9. Frontend

## Application Web

Construite avec **React**

Fonctionnalités :

* Recherche de cartes
* Visualisation des prix
* Gestion de collection

---

## Application Mobile

Construite avec **React Native**

Fonctionnalités :

* Scan de cartes via caméra
* Identification de cartes
* Suivi de collection