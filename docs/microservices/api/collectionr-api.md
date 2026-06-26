# API CollectionR — Cartes & Prix

## 1. Vue d'ensemble

Cette API expose aux clients (web / mobile) :

- les **informations des cartes** Pokémon (métadonnées) ;
- les **prix de marché** agrégés.

Elle est servie par le **backend NestJS (sur adaptateur Fastify), TypeScript**. Les données sont
lues dans **PostgreSQL**, alimenté par le **Microservice TCG** :

- **métadonnées** synchronisées depuis **TCGdex** (cf. [externe-api.md](externe-api.md)) ;
- **prix** collectés par le `Worker TCG API` depuis les APIs ouvertes (TCGdex, pokemontcg.io)
  (cf. [marketplace-scraper.md](../marketplace/marketplace-scraper.md)).

> L'API CollectionR **lit** la base ; elle ne déclenche jamais de collecte à la demande.

---

## 2. Modèles de données

### Card

Métadonnées d'une carte. L'image référence le **CDN externe** (aucune image n'est stockée
localement, conformément à l'architecture runtime).

```json
{
  "id": "swsh3-20",
  "name": "Charizard VMAX",
  "set": "Darkness Ablaze",
  "number": "20",
  "rarity": "Holo Rare VMAX",
  "types": ["Fire"],
  "hp": 330,
  "language": "EN",
  "image": "https://assets.tcgdex.net/en/swsh/swsh3/20/high.webp"
}
```

### MarketPrice (DTO agrégé)

> **`MarketPrice` est un DTO d'API agrégé**, calculé à partir des lignes de la table `card_prices`
> (et non une table). `average_price` est la **moyenne** des prix collectés pour une carte, une
> source, un **état** et une **langue** donnés. Voir le modèle `CardPrice` dans
> [marketplace-scraper.md](../marketplace/marketplace-scraper.md).

```json
{
  "card_id": "swsh3-20",
  "source": "tcgdex",
  "condition": "NM",
  "language": "EN",
  "currency": "EUR",
  "average_price": 45.50,
  "updated_at": "2026-06-14T03:00:00Z"
}
```

> **Convention :** `snake_case` pour les payloads JSON exposés par l'API ; `camelCase` pour les
> attributs Prisma côté code. La couche de présentation (NestJS/Fastify) assure la conversion.

---

## 3. Endpoints

### GET /cards/:id

Récupère une carte.

```
GET /cards/swsh3-20
```

Réponse :

```json
{
  "id": "swsh3-20",
  "name": "Charizard VMAX",
  "set": "Darkness Ablaze",
  "rarity": "Holo Rare VMAX",
  "types": ["Fire"],
  "hp": 330,
  "language": "EN",
  "image": "https://assets.tcgdex.net/en/swsh/swsh3/20/high.webp"
}
```

### GET /cards/search

Recherche une carte.

```
GET /cards/search?q=charizard&lang=en
```

Réponse :

```json
{
  "query": "charizard",
  "count": 2,
  "results": [
    { "id": "swsh3-20", "name": "Charizard VMAX", "set": "Darkness Ablaze" },
    { "id": "swsh3-19", "name": "Charizard V", "set": "Darkness Ablaze" }
  ]
}
```

### GET /market/:id

Récupère les derniers prix disponibles pour une carte.

```
GET /market/swsh3-20
```

Réponse :

```json
{
  "card_id": "swsh3-20",
  "prices": [
    {
      "source": "tcgdex",
      "condition": "NM",
      "language": "EN",
      "currency": "EUR",
      "average_price": 45.50,
      "updated_at": "2026-06-14T03:00:00Z"
    }
  ]
}
```

> Si le Microservice TCG ne s'est pas encore exécuté pour cette carte, la réponse est **vide** —
> **aucune collecte n'est déclenchée à la demande**.

---

## 4. Sources des données

| Donnée | Source | Voie |
|--------|--------|------|
| Métadonnées + images | TCGdex | `Worker TCG API` → PostgreSQL |
| Prix (Cardmarket €, TCGPlayer $) | TCGdex / pokemontcg.io | `Worker TCG API` → PostgreSQL |
| Estimation de prix | Modèle IA | `Worker TCG Prediction` |

---

## 5. Codes de réponse

| Code | Signification     |
| ---- | ----------------- |
| 200  | Succès            |
| 400  | Requête invalide  |
| 404  | Carte introuvable |
| 429  | Trop de requêtes  |
| 500  | Erreur serveur    |

---

## 6. Notes

- `average_price` est une **valeur agrégée** dérivée des prix collectés, pas un prix brut unique.
- La **langue** fait partie de l'identité d'un prix : deux prix ne sont comparables qu'à langue, état
  et édition identiques.
- Attribution des sources et **disclaimer de non-affiliation** à Nintendo / The Pokémon Company à
  afficher côté client (cf. garde-fous légaux dans [marketplace-scraper.md](../marketplace/marketplace-scraper.md)).

---

## Sources

- Données de cartes et exemple `swsh3-20` (Charizard VMAX) : **API TCGdex** — voir [externe-api.md](externe-api.md).
- Modèle de prix, agrégation et CGU : voir [marketplace-scraper.md](../marketplace/marketplace-scraper.md) (§6 et §11).
- Stack backend (NestJS / Fastify) : voir [clean-architecture.md](../../backend/clean-architecture.md).
