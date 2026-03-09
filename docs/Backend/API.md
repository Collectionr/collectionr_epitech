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
│   │   ├── card.entity.ts
│   │   └── collection.entity.ts
│
├── application
│   ├── use-cases
│   │   ├── scan-card.usecase.ts
│   │   ├── identify-card.usecase.ts
│   │   ├── get-card-data.usecase.ts
│   │   └── get-market-price.usecase.ts
│
├── infrastructure
│   ├── database
│   │   ├── prisma.service.ts
│   │   └── schema.prisma
│   │
│   ├── cache
│   │   └── redis.service.ts
│   │
│   ├── card
│   │   └── collectionr-card.service.ts
│   │
│   ├── market
│   │   ├── ebay.service.ts
│   │   ├── tcgplayer.service.ts
│   │   └── cardmarket.service.ts
│   │
│   └── scanner
│       └── scanner.client.ts
│
├── interfaces
│   ├── graphql
│   │   └── card.resolver.ts
│   │
│   └── routes
│       └── scan.routes.ts
│
└── server.ts
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

---

## CardScan

```json
{
  "scan_id": "uuid",
  "card_id": "swsh3-136",
  "hash": "string",
  "grade": 8.5,
  "confidence": 0.94,
  "detected_at": "timestamp"
}
```

---

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

# 8. Scanner Microservice Integration

The scanner microservice performs:

* card detection
* perceptual hashing
* card identification
* ML grading

The backend orchestrates the workflow.

---

## Communication Flow

```
Client
  │
  ▼
POST /scan
  │
Fastify Backend
  │
Call Scanner Microservice
  │
Image Processing
  │
Hash Matching
  │
ML Grading
  │
Return cardId
  │
Backend retrieves card metadata
  │
Backend aggregates market data
  │
Return full card data
```

---

# 9. Redis Cache Layer

Redis caches:

* card metadata
* market prices
* search queries

Example keys:

```
card:swsh3-136
card_search:pikachu
price:swsh3-136
```

Cache strategy:

| Data           | TTL   |
| -------------- | ----- |
| card metadata  | 24h   |
| market prices  | 5 min |
| search results | 1h    |

---

# 10. Complete Scan Flow

```
User scans card
     │
React Native Camera
     │
POST /scan
     │
Fastify Backend
     │
Scanner Microservice
     │
Card identification
     │
Return cardId
     │
Backend loads card metadata
     │
Backend fetches market prices
     │
Merge results
     │
Return full card info
```

---

# 11. Response Codes

| Code | Meaning          |
| ---- | ---------------- |
| 200  | Success          |
| 201  | Resource created |
| 400  | Invalid request  |
| 404  | Card not found   |
| 500  | Server error     |

---

# 12. Frontend

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
