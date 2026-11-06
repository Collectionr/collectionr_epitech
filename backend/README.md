# Collectionr — Backend

API principale du projet Collectionr : NestJS (adaptateur Fastify), TypeScript, PostgreSQL/Prisma. Voir `docs/backend/` à la racine du mono-repo pour le détail des conventions et de l'architecture.

## Installation

```bash
npm install
cp .env.example .env   # puis ajuster les valeurs (JWT_SECRET, DATABASE_URL, REDIS_URL)
```

PostgreSQL et Redis ne sont pas fournis par ce repo (provisionnement géré par l'équipe DevOps) : `DATABASE_URL`/`REDIS_URL` doivent pointer vers une instance déjà disponible.

La configuration est validée au démarrage : l'application refuse de démarrer si une variable requise (`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`) est absente ou invalide. La liste complète est documentée dans `.env.example`.

## Lancement

```bash
npm run start:dev   # mode watch
npm run start:prod  # build de production
```

## Qualité

```bash
npm run lint       # ESLint
npm run test       # tests unitaires + intégration
npm run test:cov   # tests avec couverture
npm run test:e2e   # e2e, sans infrastructure (doublures en mémoire)
npm run test:integration  # contre un VRAI PostgreSQL + Redis (voir ci-dessous)
```

### Tests d'intégration (`npm run test:integration`)

Les specs unitaires mockent Prisma, Redis et bcrypt : elles ne voient ni une requête qui matche trop de lignes, ni une course entre deux transactions, ni un script Lua. `src/contracts/*.integration-spec.ts` les exercent pour de vrai (contrat des ports Auth, scénarios d'attaque sur les sessions, limiteur Redis).

Opt-in : hors de `npm test` et du hook `pre-push`, qui doivent rester exécutables sans infra. Prérequis : le PostgreSQL et le Redis fournis par DevOps, plus **une base dédiée** (jamais celle de dev — la config refuse une URL qui la désigne) :

```bash
psql -U collectionr -c "CREATE DATABASE collectionr_test"   # une fois
npm run test:integration                                     # migre collectionr_test puis lance les specs
```

Variables optionnelles : `INTEGRATION_DATABASE_URL` (défaut `postgresql://collectionr:collectionr@localhost:5432/collectionr_test`) et `INTEGRATION_REDIS_URL` (défaut `redis://localhost:6379/15`).

## Architecture — organisation modulaire par domaine

Le code métier est organisé sous `src/modules/<domaine>/`, chaque module respectant les quatre couches de la Clean Architecture. Le détail des principes est documenté dans `docs/backend/clean-architecture.md`.

```
src/
├── shared/                  # code transverse (ex: PrismaModule) partagé entre modules
├── modules/
│   └── <domaine>/
│       ├── domain/          # entités et règles métier — aucune dépendance externe
│       ├── application/     # use cases + ports (interfaces) — orchestrent la logique métier
│       ├── infrastructure/  # implémentations concrètes des ports (Prisma, services externes)
│       └── interface/       # controllers NestJS, DTO, exposition HTTP
└── main.ts
```

- **`domain/`** : entités et règles métier fondamentales. Ne doit importer aucun package NestJS ni Prisma.
- **`application/`** : cas d'utilisation (use cases) et ports (interfaces) consommés par le domaine. Dépend uniquement d'interfaces, jamais d'implémentations concrètes.
- **`infrastructure/`** : implémentations concrètes des ports définis en `application/` (accès Prisma, appels aux microservices IA Python, etc.).
- **`interface/`** : controllers et DTO NestJS qui reçoivent les requêtes HTTP et appellent les use cases.

Un exemple de flux complet à travers les quatre couches (`GET /health`) se trouve dans `src/modules/health/`.

## Socle applicatif (COLLR-411)

Chaque endpoint hérite automatiquement des garanties transverses configurées dans `src/shared/bootstrap/ConfigureApp.ts` :

| Garantie | Détail |
|---|---|
| Config validée | Démarrage refusé si une variable d'environnement requise est absente/invalide |
| Versioning | Préfixe global `/api/v1` (URI versioning) — `/health` reste hors préfixe pour les probes K3s |
| Validation DTO | `ValidationPipe` global : `whitelist`, `forbidNonWhitelisted`, `transform` |
| Erreurs | Format standardisé `{ statusCode, error, message, timestamp, path }` — les 5xx sont génériques côté client, détaillées dans les logs |
| CORS | Origines explicites via `CORS_ORIGINS`, credentials, pas de wildcard |
| Rate limiting | Throttler global (`THROTTLE_TTL` / `THROTTLE_LIMIT`), 429 au format standard |
| Logs | JSON structuré (pino), niveau via `LOG_LEVEL`, en-têtes sensibles caviardés, `pino-pretty` en dev |
| Sécurité HTTP | Helmet (`@fastify/helmet`) : CSP, `X-Frame-Options`, `nosniff`, etc. |
| Healthcheck | `GET /health` vérifie réellement PostgreSQL (`SELECT 1`) et Redis (`PING`) — 200 ok / 503 degraded |
| Documentation | Swagger UI sur `/api/docs` (JSON sur `/api/docs-json`), Bearer JWT, tags par domaine, désactivable via `SWAGGER_ENABLED` |
