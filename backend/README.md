# Collectionr — Backend

API principale du projet Collectionr : NestJS (adaptateur Fastify), TypeScript, PostgreSQL/Prisma. Voir `docs/backend/` à la racine du mono-repo pour le détail des conventions et de l'architecture.

## Installation

```bash
npm install
```

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
```

## Architecture — organisation modulaire par domaine

Le code métier est organisé sous `src/modules/<domaine>/`, chaque module respectant les quatre couches de la Clean Architecture. Le détail des principes est documenté dans `docs/backend/clean-architecture.md`.

```
src/
├── shared/                  # code transverse (ex: PrismaService) partagé entre modules
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
