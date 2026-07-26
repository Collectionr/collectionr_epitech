# État du projet — à maintenir entre sessions

> Mettre à jour ce fichier quand un ticket est terminé, une décision prise, ou un piège découvert.

_Dernière mise à jour : 2026-07-26 (fin COLLR-411)_

## Fait

- **COLLR-410** — Init projet backend + standards qualité (mergé sur `main`)
- **COLLR-411** — Bootstrap applicatif, 9 sous-tâches (COLLR-428→436) : validation env, `/api/v1`, ValidationPipe durci, filtre d'exception, CORS, Throttler, pino, `/health` réel (pg + ioredis), Swagger complet, Helmet.
  Branche `COLLR-411/feat/bootstrap-applicatif`, un commit par sous-tâche. Validé de bout en bout en local (200 ok avec Postgres/Redis docker, 503 degraded sans).

## En cours / à venir

- **COLLR-412** — Setup base de données (outillage Prisma/PostgreSQL). ⚠️ À cette occasion : remplacer `PostgresHealthIndicator` (pool `pg`) par une implémentation Prisma du port `IHealthIndicator` — cf. ADR-004.
- Epic Authentification — inclut le rate limiting renforcé login/register (ADR-008) et le schéma Bearer JWT déjà déclaré dans Swagger (`access-token`).
- CI/CD : arbitrage GitHub Actions vs Jenkins non tranché avant Alpha (équipe Cloud & Cyber).

## Modules existants

| Module | Rôle | Notes |
| --- | --- | --- |
| `src/modules/health` | Healthcheck DB + Redis | **Exemple de référence** des 4 couches + ports |
| `src/shared` | Socle transverse | config, bootstrap, filtres, pipes, clients pg/redis |

## Pièges connus

- **Prisma 7** (7.9) : breaking changes majeurs — plus de `url` dans `schema.prisma` (erreur P1012), connexion via driver adapter (`@prisma/adapter-pg`) passé au constructeur `PrismaClient`, config migrate dans `prisma.config.ts`. À anticiper pour COLLR-412.
- **Swagger UI + Fastify** exige `@fastify/static` (déjà installé).
- Warning au boot « Unsupported route path: /api/* » (LegacyRouteConverter) : bénin, vient du `setGlobalPrefix` avec exclusion — auto-converti par Nest.
- Le dev se fait sous **Windows** (Git Bash + PowerShell) : scripts npm cross-platform uniquement.

## Environnement local

- `docker compose up -d` (racine) : Postgres 16 + Redis 7, identifiants `collectionr`/`collectionr`, alignés sur `backend/.env.example`.
- `backend/.env` local (gitignoré) existe avec ces valeurs.
