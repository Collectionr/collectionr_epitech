# 📘 Pokémon Card Scanner & Market API

## 1. Overview

This API allows users to:

* Scan a Pokémon card using the device camera
* Automatically identify the card
* Estimate its condition (grading) using Machine Learning
* Retrieve market price data
* Store cards in a user's personal collection

The system architecture is composed of:

* **TypeScript backend using Fastify**
* **Python microservice for computer vision**
* **PostgreSQL database with Prisma ORM**
* **Redis caching layer**
* **React / React Native frontend**

---

# 2. System Architecture

```id="arch001"
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
        └── Market Data Aggregator
                GraphQL
              /         \
        Cardmarket      eBay API
```

---

# 3. Backend Architecture

The backend is built with:

* **TypeScript**
* **Fastify**
* **Prisma**
* **PostgreSQL**
* **Redis**

Clean architecture structure:

```id="arch002"
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
│   ├── market
│   │   ├── ebay.service.ts
│   │   └── cardmarket.scraper.ts
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

# 4. Data Models

## Card

```json id="model001"
{
  "id": "uuid",
  "name": "Pikachu",
  "set": "Base Set",
  "number": "25",
  "rarity": "Rare",
  "image_url": "string"
}
```

---

## CardScan

```json id="model002"
{
  "scan_id": "uuid",
  "card_id": "uuid",
  "hash": "string",
  "grade": 8.5,
  "detected_at": "timestamp"
}
```

---

## MarketPrice

```json id="model003"
{
  "card_id": "uuid",
  "source": "ebay",
  "average_price": 45.5,
  "currency": "EUR"
}
```

---

# 5. API Endpoints

The backend exposes:

* **REST API** → for card scanning
* **GraphQL API** → for card and market data

---

# REST API – Scanner

## POST /scan

Uploads an image to identify a Pokémon card.

### Request

```id="req001"
POST /scan
```

### Payload

```json id="req002"
{
  "image": "base64_encoded_image"
}
```

### Processing Flow

1. Image is sent to the Python scanner service
2. Perceptual hashing
3. Database matching
4. ML grading
5. Cache lookup via Redis (for known cards)

### Response

```json id="res001"
{
  "card_id": "uuid",
  "name": "Pikachu",
  "grade": 8.2,
  "confidence": 0.94
}
```

---

# Scanner Microservice

Python service built with:

liaison

---

# GraphQL API

The backend exposes the endpoint:

```id="gql001"
/graphql
```

Built with **GraphQL**.

---

## Query – Card

```id="gql002"
query {
  card(id: "25") {
    name
    set
    rarity
  }
}
```

---

## Query – Market Price

Aggregates market data from:

* eBay API
* Cardmarket scraping

```id="gql003"
query {
  marketPrice(cardId: "25") {
    source
    averagePrice
    currency
  }
}
```

### Response

```json id="gql004"
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

# 6. Complete Scan Flow

```id="flow001"
User scans card
     │
React Native Camera
     │
POST /scan
     │
Fastify API
     │
Scanner Microservice
     │
Hash matching
     │
ML grading
     │
Card identified
     │
Redis cache lookup
     │
GraphQL market query
     │
Return full card info
```

---

# 8. Response Codes

| Code | Meaning          |
| ---- | ---------------- |
| 200  | Success          |
| 201  | Resource created |
| 400  | Invalid request  |
| 401  | Unauthorized     |
| 404  | Card not found   |
| 500  | Server error     |

---

# 9. Frontend

Two client applications consume the API:

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
