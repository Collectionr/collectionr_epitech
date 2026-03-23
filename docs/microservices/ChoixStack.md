# 📘 Stack Technique Backend
## CollectionR

---

# 1. Backend Stack

| Component    | Technology |
| ------------ | ---------- |
| Framework    | NestJS     |
| Language     | TypeScript |
| HTTP Adapter | Fastify    |
| ORM          | Prisma     |
| Database     | PostgreSQL |
| Cache        | Redis      |

---

# 2. Backend Architecture

Le backend suit une **Clean Architecture** afin de garantir :

* séparation des responsabilités
* code maintenable
* indépendance du framework
* facilité de test

[Voir documentation Clean Architecture](./clean-architecture.md)


# 3. Backend Framework

Le backend est développé avec **NestJS**.

NestJS fournit :

* architecture modulaire
* dependency injection
* structure claire pour les grandes applications
* intégration TypeScript native

Les modules principaux sont organisés autour des domaines fonctionnels :

```
modules
│
├── cards
├── collections
├── prices
└── scanner
```

Chaque module contient :

```
module
├── domain
├── application
├── infrastructure
└── interface
```

---

# 4. HTTP Layer

Le serveur HTTP utilise **Fastify** comme adapter pour NestJS.

Configuration :

```
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter()
);
```

Fastify permet :

* meilleures performances
* gestion efficace des requêtes concurrentes
* overhead réduit

---

# 5. Database

La base de données principale est **PostgreSQL**.

Elle stocke :

* les cartes
* les collections utilisateurs
* les sets
* les prix historisés

### Modèle simplifié

```
User
Card
Set
Collection
CollectionItem
Price
```

Relations :

```
User
 └── Collection

Collection
 └── CollectionItem

CollectionItem
 └── Card

Card
 └── Set
```

---

# 6. ORM

Le projet utilise **Prisma** comme ORM.

Prisma permet :

* génération automatique des types TypeScript
* migrations simples
* requêtes optimisées
* intégration facile avec NestJS

### Exemple schema

```
model Card {
  id        String   @id @default(uuid())
  name      String
  set       String
  rarity    String
  imageUrl  String
}
```

### Exemple requête

```
await prisma.card.findMany({
  where: {
    name: {
      contains: "Pikachu"
    }
  }
});
```

---

# 7. Cache Layer

Le backend utilise **Redis** pour le caching.

Le cache permet de réduire :

* les requêtes répétées à la base
* les appels aux APIs externes

### Types de données cachées

| Data           | Purpose                     |
| -------------- | --------------------------- |
| card metadata  | accélérer les requêtes      |
| price data     | limiter les appels externes |
| search results | améliorer la recherche      |

### Exemple clé Redis

```
card:charizard
price:charizard:base_set
```

---

# 8. Card Service

Le **Card Service** gère les données relatives aux cartes.

Fonctions principales :

* récupération des cartes
* recherche de cartes
* récupération des sets
* récupération des métadonnées

Exemples d'endpoints :

```
GET /cards
GET /cards/:id
GET /cards/search?q=pikachu
```

---

# 9. Collection Service

Le **Collection Service** permet aux utilisateurs de gérer leur collection.

Fonctions :

* ajouter une carte
* supprimer une carte
* modifier l’état
* récupérer la collection

Exemple endpoint :

```
POST /collections/add-card
```

Payload :

```
{
  "cardId": "uuid",
  "condition": "NM",
  "quantity": 1
}
```

---

# 10. Price Service

Le **Price Service** récupère et consolide les prix des cartes.

Flux :

```
Client request
     │
     ▼
Price Service
     │
Check Redis Cache
     │
 ┌───┴────┐
 │ Cache  │
 │  Hit   │
 └───┬────┘
     │
Return price
     │

Cache Miss
     │
Call external price APIs
     │
Compute aggregated price
     │
Store in Redis
     │
Return result
```

---

# 11. Scanner Integration

Le backend communique avec un service de **scan d’image** pour identifier les cartes.

Flux :

```
Mobile App
   │
Upload image
   │
Scanner service
   │
Return cardId
   │
Backend
   │
Fetch metadata
   │
Return card information
```

Le backend agit ici comme **orchestrateur des données**.

---

# 12. Pagination & Performance

Les endpoints qui retournent des listes utilisent une pagination standard.

Exemple :

```
GET /cards?page=1&limit=50
```

Réponse :

```
{
  "data": [],
  "page": 1,
  "limit": 50,
  "total": 10234
}
```

---

# 13. Backend Responsibilities

Le backend est responsable de :

* gestion des cartes
* gestion des collections
* agrégation des prix
* orchestration du scanner
* optimisation des requêtes
* gestion du cache Redis

---

# 14. Backend Stack Summary

Stack utilisée :

```
Backend Framework
NestJS (TypeScript)

HTTP Server
Fastify

Database
PostgreSQL

ORM
Prisma

Cache
Redis
```

