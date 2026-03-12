# 📚 Card Data Provider Strategy
### Pokémon Card Scanner & CollectionR API

## 1. Overview

To develop the **CollectionR Pokémon Card Scanner**, the backend requires a reliable source of **TCG card metadata and images**.

At the early stage of development, using an **external API as a temporary database** is recommended in order to:

- accelerate development
- avoid building a complete card dataset immediately
- focus on core features (scanner, grading, collections)

Later, the system will transition to a **self-hosted internal card database**.

---

# 2. Card Data Sources

Several APIs provide Pokémon card data. The most relevant ones are:

| API | Purpose | Notes |
|----|----|----|
| TCGDex API | Card metadata | Best for development |
| Pokémon TCG API | Card metadata | Popular but rate-limited |
| TCG.dev | Market data | Price aggregation |

---

# 3. TCGDex API

TCGDex is an open-source API providing complete Pokémon card metadata.

Features:

- ~22,000 Pokémon cards
- multiple languages
- card metadata
- sets and series
- attacks and abilities
- hosted images
- REST API

Example endpoint:

```

GET [https://api.tcgdex.net/v2/en/cards/swsh3-136](https://api.tcgdex.net/v2/en/cards/swsh3-136)

````

Example response:

```json
{
  "id": "swsh3-136",
  "name": "Charizard",
  "hp": 170,
  "types": ["Fire"],
  "attacks": [],
  "image": "https://assets.tcgdex.net/en/swsh/swsh3/136"
}
````

Advantages:

* free
* open source
* stable
* no API key required
* complete dataset
* hosted card images

---

# 4. Alternative API

## Pokémon TCG API

Another widely used API for Pokémon card data.

Example request:

```
GET https://api.pokemontcg.io/v2/cards?q=name:pikachu
```

Example response:

```json
{
  "data": [
    {
      "id": "base1-25",
      "name": "Pikachu",
      "images": {
        "small": "...",
        "large": "..."
      }
    }
  ]
}
```

Advantages:

* well maintained
* widely used
* large dataset

Limitations:

* requires an API key
* rate limits
* sometimes slower than local DB access

---

# 5. Market Data API

## TCG.dev API

Used primarily for **price aggregation**.

Typical sources:

* Cardmarket
* eBay
* TCGPlayer

Example:

```
GET /cards/{id}/prices
```

This API is mainly used for:

* price tracking
* market value estimation
* price history

Note: some features may require paid access.

---

# 6. Recommended Architecture

For long-term stability, the project should use a **hybrid architecture**.

External APIs are used only as **data providers**, while the application maintains its own **internal card database**.

### Architecture

```
External Card API (TCGDex)
        │
        ▼
Sync Worker / Data Import Script
        │
        ▼
PostgreSQL Card Database
        │
        ▼
NestJS / Fastify Backend
        │
        ▼
Scanner Microservice
```

---

# 7. Why Use an Internal Card Database

Using an external API directly in production can introduce:

* latency
* downtime risks
* rate limits
* dependency on third-party services

Performance comparison:

| Source         | Average latency |
| -------------- | --------------- |
| External API   | 200-500 ms      |
| Local Database | 2-5 ms          |

A local database dramatically improves:

* scanner speed
* search performance
* reliability

---

# 8. Recommended Development Strategy

### Phase 1 — Development

Use **TCGDex API directly**.

Goals:

* develop backend services
* implement scanner pipeline
* build frontend features

Architecture:

```
Frontend
   │
   ▼
Backend API
   │
   ▼
TCGDex API
```

---

### Phase 2 — Data Synchronization

Introduce a **sync worker** that periodically imports card data.

```
TCGDex API
     │
     ▼
Sync Worker
     │
     ▼
PostgreSQL Card DB
```

---

### Phase 3 — Production Architecture

Final architecture:

```
React / React Native
        │
        ▼
Backend API (NestJS / Fastify)
        │
        ├── Redis Cache
        │
        ├── PostgreSQL App DB
        │      users
        │      collections
        │      scans
        │
        ├── PostgreSQL Card DB
        │      cards
        │      sets
        │      abilities
        │      attacks
        │
        └── Scanner Microservice
               FastAPI + OpenCV
```

External APIs are then used only as **fallback or update sources**.

---

# 9. Backend Example (TypeScript)

Example service using TCGDex.

```ts
@Injectable()
export class TcgdexService {

  async getCard(id: string) {
    const response = await fetch(
      `https://api.tcgdex.net/v2/en/cards/${id}`
    )

    return response.json()
  }

}
```

---

# 10. Final Recommendation

| Component     | Recommendation          |
| ------------- | ----------------------- |
| Card metadata | TCGDex API (initial)    |
| Card storage  | PostgreSQL              |
| ORM           | Prisma                  |
| Cache         | Redis                   |
| Backend       | NestJS + Fastify        |
| Scanner       | Python FastAPI + OpenCV |

Development approach:

1. Start with **TCGDex API**
2. Import card dataset into **PostgreSQL**
3. Use external APIs only for **updates or fallback**

---

# 11. Key Benefits

This architecture provides:

* fast card lookup
* independence from external APIs
* scalable infrastructure
* optimized scanner performance

```

---
