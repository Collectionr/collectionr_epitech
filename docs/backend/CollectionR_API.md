# 📘 Pokémon Card Scanner & CollectionR API

---

# 1. Overview

This API allows users to:

* Scan a Pokémon card using the device camera
* Automatically identify the card
* Estimate its condition (grading) using Machine Learning
* Retrieve card metadata
* Retrieve market price data
* Store cards in a user's personal collection

The system architecture is composed of:

* **TypeScript backend using Fastify**
* **Python microservice for computer vision**
* **PostgreSQL database with Prisma ORM**
* **Redis caching layer**
* **React / React Native frontend**
* **CollectionR internal card API**
* **External market data APIs**

---

# 2. System Architecture

```text
React / React Native App
        │
        │ REST / GraphQL
        ▼
Fastify API Server (TypeScript)
        │
        ├── Redis (Cache Layer)
        │
        ├── PostgreSQL Database
        │       Prisma ORM
        │
        ├── Scanner Microservice
        │       FastAPI + OpenCV
        │
        ├── CollectionR Card API
        │       Internal Card Metadata
        │
        └── Market Data Aggregator
                │
        ┌───────────────┬───────────────┐
        ▼               ▼               ▼
   Cardmarket API      eBay API     TCGPlayer API
```

The **CollectionR API remains the primary internal source for card metadata**, while market APIs provide **price information and additional data enrichment**.

---

# 3. Backend Architecture

The backend is built with:

* **TypeScript**
* **Fastify**
* **Prisma**
* **PostgreSQL**
* **Redis**

Clean architecture structure:

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

# 4. CollectionR Card API

## Purpose

The **CollectionR Card API** manages **internal TCG card metadata**.

Goals:

* maintain a **complete internal database of TCG cards**
* provide a **stable and consistent card data source**
* reduce dependency on external card APIs
* enable internal enrichment with market data

Inspired by APIs such as:

```
https://api.tcgdex.net/v2/en/cards/swsh3-136
```

But implemented internally.

---

## Responsibilities

The API must:

* store TCG card metadata
* retrieve card information
* support card lookup by ID
* support search operations
* merge metadata with market data

External APIs are used **only for price enrichment**, not as the primary card metadata source.

---

# 5. Data Models

## Card

```json
{
  "id": "swsh3-136",
  "name": "Charizard",
  "set": {
    "id": "swsh3",
    "name": "Darkness Ablaze"
  },
  "number": "136",
  "rarity": "Rare Holo",
  "types": ["Fire"],
  "hp": 170,
  "image": "https://cdn.collectionr/cards/swsh3-136.png"
}
```

## MarketPrice

```json
{
  "card_id": "swsh3-136",
  "source": "ebay",
  "average_price": 45.5,
  "currency": "EUR"
}
```

---

# 6. Card API Endpoints

---

## GET /cards/:id

Retrieve card metadata.

```http
GET /cards/swsh3-136
```

Response:

```json
{
  "id": "swsh3-136",
  "name": "Charizard",
  "set": "Darkness Ablaze",
  "rarity": "Rare Holo"
}
```

---

## GET /cards/search

Search cards by name.

```
GET /cards/search?q=pikachu
```

---

# 7. Market Data Aggregation

The backend aggregates market prices from multiple APIs.

Sources:

* **Cardmarket API**
* **eBay API**
* **TCGPlayer API**

The system merges the data to compute an **average market value**.

---

## Example GraphQL Query

```graphql
query {
  marketPrice(cardId: "swsh3-136") {
    source
    averagePrice
    currency
  }
}
```

Response:

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

# 8. Response Codes

| Code | Meaning          |
| ---- | ---------------- |
| 200  | Success          |
| 201  | Resource created |
| 400  | Invalid request  |
| 404  | Card not found   |
| 500  | Server error     |

---

# 9. Frontend

### Web App

Built with **React**

Features:

* card search
* price visualization
* collection management

---

### Mobile App

Built with **React Native**

Features:

* camera card scanning
* card identification
* collection tracking

---
