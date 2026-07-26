# Collectionr — Monorepo

App web + mobile pour collectionneurs de cartes Pokémon TCG (projet Epitech, équipe de 9, jalons Alpha déc. 2026 / Beta mars 2027 / V1 juin 2027).
Ce repo contient le backend (`backend/`) et la documentation d'équipe (`docs/`).

## Stack backend

- NestJS 11 + **Fastify** · TypeScript strict (zéro `any`) · Node ≥ 24
- PostgreSQL (client `pg` léger pour l'instant — **Prisma arrive avec COLLR-412**) · Redis (ioredis)
- nestjs-pino (logs JSON) · @nestjs/throttler · @nestjs/swagger · @fastify/helmet
- Jest (unit dans `src/`, e2e dans `test/`) · ESLint + Prettier

## Commandes (depuis `backend/`)

```bash
npm run start:dev    # dev watch (pino-pretty)
npm run lint         # ESLint (lint:fix pour corriger)
npm test             # tests unitaires
npm run test:cov     # couverture — seuil global 70 % obligatoire
npm run test:e2e     # tests e2e (aucune infra requise : doublures)
npm run build        # nest build
```

```bash
docker compose up -d   # à la racine : PostgreSQL + Redis locaux (cf. backend/.env.example)
```

## Invariants absolus

- **Fichiers en PascalCase** avec suffixe de type : `CarteController.ts`, `CreateCarteUseCase.ts`, `HealthModule.ts` — jamais de kebab-case.
- **Clean Architecture 4 couches** par module (`domain/`, `application/`, `infrastructure/`, `interface/`). Le module `src/modules/health/` est l'exemple de référence.
- **`domain/` n'importe aucun framework** (NestJS, Prisma…) — une règle ESLint le bloque.
- Les use cases dépendent de **ports (interfaces + token d'injection)**, jamais d'implémentations. Implémentations dans `infrastructure/`, câblage dans le `XxxModule`.
- **Toute config transverse passe par `src/shared/bootstrap/ConfigureApp.ts`** (préfixe `/api/v1`, ValidationPipe, CORS, Helmet, Swagger). Ne jamais dupliquer dans un module — un nouveau endpoint hérite du socle automatiquement.
- **Format d'erreur API unique** : `{ statusCode, error, message, timestamp, path }` (filtre global `AllExceptionsFilter`). Les 5xx sont génériques côté client, stack loguée côté serveur.
- **Variables d'environnement** : déclarées + validées dans `src/shared/config/EnvironmentVariables.ts`, documentées dans `backend/.env.example` (source de vérité). Nouvelle variable = les deux fichiers + un défaut sûr.
- **Tests** : un `.spec.ts` à côté du code pour la logique, e2e sans infra réelle (doublures via `overrideProvider`). Couverture ≥ 70 % (seuil bloquant).
- `/health` reste **hors préfixe** `/api/v1` (probes K3s) — ne pas le déplacer.

## Git / Jira

- Projet Jira : **COLLR** (site collectionr.atlassian.net). Branches : `COLLR-xxx/feat/description`.
- Commits : **français**, conventional commits, clé Jira en suffixe — ex. `feat(backend): ajoute X (COLLR-123)`.
- **Ne jamais push** — l'utilisateur push lui-même. PR avec revue 2 yeux minimum.

## Où chercher

| Besoin | Fichier |
| --- | --- |
| Conventions de code détaillées | `docs/backend/conventions.md` |
| Principes Clean Architecture | `docs/backend/clean-architecture.md` |
| Décisions d'architecture (ADRs) | `.claude/contexts/architecture.md` |
| État actuel du projet / tickets | `.claude/contexts/project_state.md` |
| Créer un nouveau module | `.claude/patterns/module.pattern.md` |
| Erreur déjà rencontrée | `.claude/errors/` |
| Débrief technique de la session | `/debrief` (`.claude/commands/debrief.md`) |
| Synchroniser la doc IA avec le code | `/sync-claude` (`.claude/commands/sync-claude.md`) |
| Checklist avant PR | `.claude/checklists/pre_merge.md` |
| Stack complète / contexte produit | `docs/stack-technique.md`, `docs/architecture/` |
