# 📘 Stack Technique 

## 📑 Table des Matières

- [1. Stack](#1-stack)
  - [Backend](#backend)
  - [Frontend Web](#frontend-web)
  - [Frontend Mobile](#frontend-mobile)
  - [Microservices Python](#microservices-python)
  - [Real-time Communication](#real-time-communication)
  - [File Storage](#file-storage)
- [2. Backend Architecture](#2-backend-architecture)
- [3. Backend Framework](#3-backend-framework)
- [4. Backend Responsibilities](#4-backend-responsibilities)
- [5. HTTP Layer](#5-http-layer)
- [6. Database](#6-database)
- [7. ORM](#7-orm)
- [8. Cache Layer & Task Queues](#8-cache-layer--task-queues)
  - [Redis OCR](#redis-ocr-reconnaissance-de-cartes)
  - [Redis Scraping](#redis-scraping-agrégation-des-prix)
- [9. Python Microservices & ML Pipeline](#9-python-microservices--ml-pipeline)
- [10. Frontend Stack](#16-frontend-stack-en-attente-de-construction)

---

# 1. Stack

## Backend

| Component    | Technology |
| ------------ | ---------- |
| Framework    | NestJS     |
| Language     | TypeScript |
| HTTP Adapter | Fastify    |
| ORM          | Prisma     |
| Database     | PostgreSQL |
| Task Queues  | Redis OCR + Redis Scraping |

## Frontend Web

| Component    | Technology |
| ------------ | ---------- |
| Framework    | React      |
| Language     | TypeScript |
| Routing      | React Router |
| State Mgmt   | ... |
| Styling      | ... |
| HTTP Client  | Axios      |
| Build Tool   | ...       |

## Frontend Mobile

| Component    | Technology |
| ------------ | ---------- |
| Framework    | React Native |
| Platform     | Expo / EAS Build    |
| Language     | TypeScript |
| Navigation   | React Navigation |
| State Mgmt   | ...    |
| Styling      | ... |
| HTTP Client  | Axios      |
| Camera       | Expo Camera |

## Microservices Python

| Component    | Technology |
| ------------ | ---------- |
| Framework    | FastAPI    |
| Language     | Python     |
| ML Libraries | ... |
| Scraping     | ... |
| Data Processing | ... |
| Orchestration | ... |
| Workers      | OCR, Scraping, Data Pipeline |

## Real-time Communication

| Component    | Technology |
| ------------ | ---------- |
| Protocol     | WebSockets |
| Library      | Socket.io / ws |
| Language     | TypeScript (Backend) |
| Purpose      | Live notifications for OCR/Scraping |

## File Storage

| Component    | Technology |
| ------------ | ---------- |
| Storage Type | Object Storage |
| Implementation | ... |
| Purpose      | Store uploaded card images |
| Accessed by  | Worker OCR, Frontend

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


# 4. Backend Responsibilities

Le backend est responsable de :

* gestion des cartes
* gestion des collections
* agrégation des prix
* orchestration du scanner
* optimisation des requêtes
* gestion du cache Redis

---

# 5. HTTP Layer

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

# 6. Database

La base de données principale est **PostgreSQL**.

PostgreSQL permet :

* stockage de données relationnelles robustes
* transactions ACID pour l'intégrité des données
* support du JSON pour les données flexibles
* extensibilité via les extensions
* performance optimale pour les requêtes complexes
* sécurité renforcée avec authentification et permissions

[Voir documentation métier](../database/documentation-metier.md)

[Voir Schema SQL](../database/schema-sql.md)

---

# 7. ORM

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

# 8. Cache Layer & Task Queues

Le backend utilise **deux instances Redis** pour des responsabilités distinctes :

## Redis OCR (Reconnaissance de Cartes)

Redis OCR gère la file d'attente pour la reconnaissance optique de caractères et l'extraction de données des images de cartes.

Responsabilités :

* mise en file d'attente des images
* gestion des tâches OCR
* récupération des tâches pour le Worker OCR
* stockage temporaire des résultats d'extraction

Flux :

```
Frontend
   │
Upload image
   │
Backend
   │
Enqueue task → Redis OCR
                   │
              Worker OCR
                   │
           Extract card data
                   │
           Store results
```

### Exemple clé Redis OCR

```
queue:ocr:pending
result:ocr:{taskId}
task:ocr:{taskId}:status
```

---

## Redis Scraping (Agrégation des Prix)

Redis Scraping gère la planification et l'exécution des tâches de scraping pour récupérer les prix des cartes depuis les différentes marketplace (ebay, TCG Market, etc.).

Responsabilités :

* planification des tâches de scraping
* mise en file d'attente des prix à récupérer
* gestion des tâches pour le Worker Scraping
* stockage du cache des prix

Flux :

```
Backend
   │
Schedule scraping task
   │
Redis Scraping
   │
Worker Scraping
   │
Fetch prices from TCG APIs
   │
Store in PostgreSQL
   │
Update cache
```

### Exemple clé Redis Scraping

```
queue:scraping:pending
cache:price:{cardId}
task:scraping:{taskId}:status
schedule:scraping:daily
```

---

## Résumé des deux Redis

| Aspect              | Redis OCR           | Redis Scraping       |
| ------------------- | ------------------- | -------------------- |
| **Responsabilité**  | Reconnaissance OCR  | Agrégation des prix  |
| **Worker**          | Worker OCR          | Worker Scraping      |
| **Source de données** | Images utilisateur  | APIs TCG externes    |
| **Cache**           | Métadonnées OCR     | Prix des cartes      |
| **Fréquence**       | À la demande        | Planifiée (quotidien)|
| **TTL**             | Court (1h)          | Long (24h)           |

---

# 9. Python Microservices & ML Pipeline

Le *backend NestJS** n'exécute **pas directement** les tâches de traitement intensif. Il utilise des **microservices Python indépendants** qui consomment les queues Redis et stockent les résultats dans PostgreSQL.

Les **microservices** s'occuperront de **l'api collectionr**, le **scraping des marketplace** ainsi que **l'OCR** 

### TODO: Documentation des Microservices

**Responsables** :
- Alexis pour la partie API et Scraping
- Youness pour la partie OCR

**À documenter** :
- [ ] Architecture générale des microservices
- [ ] FastAPI configuration et endpoints
- [ ] Scraping workers (marketplaces, pricing)
- [ ] OCR pipeline et ML models
- [ ] Communication Redis avec le backend NestJS
- [ ] Stockage des résultats dans PostgreSQL
- [ ] Error handling et retry logic
- [ ] Monitoring et logging

# 10. Frontend Stack (En Attente de Construction)

>  **Note** : La stack frontend est définie dans la [section 1](#1-stack). Cette section détaille les aspects à documenter pour l'implémentation.

### TODO: Documentation du Frontend

**Responsable** : François

**À documenter** :
- [ ] Architecture globale frontend (web + mobile)
- [ ] Structure des composants React
- [ ] Organisation des dossiers frontend
- [ ] Configuration Expo Go et EAS Build
- [ ] Services frontend (API client, HTTP interceptors)
- [ ] State management patterns
- [ ] Authentification côté client
- [ ] Intégration du scanner mobile (Expo Camera)
- [ ] Autre...

**Responsable** : François

