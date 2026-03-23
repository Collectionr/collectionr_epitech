# TCGDex API Integration

## Overview

The project currently relies on the **TCGDex API** as an external data provider for Pokémon TCG card metadata.

TCGDex is an **open-source REST API** that provides structured data for Pokémon Trading Card Game cards, including card details, sets, series, and images.

It is used during development as a **temporary card database** before migrating the data into the internal **CollectionR Card Database**.

---

## Main Features

The API provides:

- Pokémon card metadata
- Card sets and series
- Attack and ability information
- Card images
- Multi-language support
- REST endpoints

Dataset size:

- ~22,000 Pokémon cards
- Multiple languages (EN, FR, JP, etc.)

---

## Example Endpoint

Retrieve a specific card by ID.

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
  "attacks": [
    {
      "name": "Fire Spin",
      "damage": "220"
    }
  ],
  "image": "https://assets.tcgdex.net/en/swsh/swsh3/136/high.webp"
}
````

---

## Usage in the Backend

The backend can fetch card data from TCGDex using a simple HTTP request.

Example service implementation in TypeScript:

```ts
async function getCard(id: string) {
  const response = await fetch(
    `https://api.tcgdex.net/v2/en/cards/${id}`
  );

  return response.json();
}
```

Typical usage:

* retrieve card metadata
* retrieve images
* populate the internal database
* assist the scanner pipeline

---

## Integration Strategy

During early development, the backend may directly query TCGDex.

In production, the architecture will evolve toward:

```
TCGDex API
    │
    ▼
Data Sync Worker
    │
    ▼
CollectionR Card Database (PostgreSQL)
    │
    ▼
Backend API
```

This ensures:

* faster queries
* independence from third-party APIs
* better reliability

---

## Official Documentation

For the complete API reference, visit the official documentation:

TCGDex API documentation:
[https://tcgdex.dev](https://tcgdex.dev)

API base endpoint:
[https://api.tcgdex.net](https://api.tcgdex.net)

---

## Notes

* No API key is required.
* The API is free and open source.
* Images are hosted on the TCGDex CDN.
* The API supports multiple languages.

Example language parameter:

```
/v2/en/cards/{id}
/v2/fr/cards/{id}
```
