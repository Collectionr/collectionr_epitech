# État du projet — à maintenir entre sessions

> Mettre à jour ce fichier quand un ticket est terminé, une décision prise, ou un piège découvert.

_Dernière mise à jour : 2026-09-16 (outillage Husky + vérification COLLR-411)_

## Fait

- **COLLR-410** — Init projet backend + standards qualité (mergé sur `main`)
- **COLLR-411** — Bootstrap applicatif, 9 sous-tâches (COLLR-428→436) : validation env, `/api/v1`, ValidationPipe durci, filtre d'exception, CORS, Throttler, pino, `/health` réel (pg + ioredis), Swagger complet, Helmet.
  Branche `COLLR-411/feat/bootstrap-applicatif`, un commit par sous-tâche. Validé de bout en bout en local (200 ok avec Postgres/Redis disponibles, 503 degraded sans). Re-vérifié le 2026-09-16 : lint clean, 34 tests unitaires + 16 e2e OK, couverture 96,29 %. Sous-tâches 428→436 assignées à Alexis Ferrere et passées "En cours" dans Jira ; le ticket COLLR-411 lui-même reste "En cours" côté Jira (pas encore transitionné en "Terminé").
- **Outillage Git (Husky)** — hooks `pre-commit`/`commit-msg`/`pre-push` mis en place à la racine du monorepo, cf. section dédiée ci-dessous. Ticket [COLLR-591](https://collectionr.atlassian.net/browse/COLLR-591) (sous-tâche de COLLR-411).
- `main.ts` affiche désormais l'URL de l'app, du healthcheck et de Swagger au démarrage (`Logger.log`), pour éviter la confusion "pas de localhost affiché".

## En cours / à venir

- **COLLR-412** — Setup base de données (outillage Prisma/PostgreSQL). ⚠️ À cette occasion : remplacer `PostgresHealthIndicator` (pool `pg`) par une implémentation Prisma du port `IHealthIndicator` — cf. ADR-004.
- Epic Authentification — inclut le rate limiting renforcé login/register (ADR-008) et le schéma Bearer JWT déjà déclaré dans Swagger (`access-token`).
- CI/CD : arbitrage GitHub Actions vs Jenkins non tranché avant Alpha (équipe Cloud & Cyber).
- Nettoyer les fichiers Husky encore non commités sur `COLLR-411/feat/bootstrap-applicatif` : `.husky/pre-commit` (check de branche), `scripts/verify-branch-name.js`, `scripts/constants.js`, refactor de `scripts/verify-commit-msg.js`.

## Modules existants

| Module | Rôle | Notes |
| --- | --- | --- |
| `src/modules/health` | Healthcheck DB + Redis | **Exemple de référence** des 4 couches + ports |
| `src/shared` | Socle transverse | config, bootstrap, filtres, pipes, clients pg/redis |

## Outillage Git (Husky)

Racine du monorepo (pas dans `backend/`) : `package.json` + `package-lock.json` racine (devDependencies `husky`, `lint-staged`), `.husky/`, `scripts/`.

- **`pre-commit`** : vérifie le nom de la branche courante (`scripts/verify-branch-name.js`, format `COLLR-xxx/type/description`, `main`/`dev` exemptées) puis lance `lint-staged` (`backend/.lintstagedrc.json`, ESLint `--fix` + Prettier sur les `.ts` staged de `backend/`, via `--cwd backend`).
- **`commit-msg`** : `scripts/verify-commit-msg.js` valide le format `type: description` ou `type(dossier): description` (types conventional commits). La clé Jira en suffixe n'est **plus obligatoire** (décision explicite en session, cf. `git log` sur `scripts/verify-commit-msg.js`) — CLAUDE.md à surveiller si ce point est recontesté.
- **`pre-push`** : `npm run lint && npm run test:cov` dans `backend/` — seul filet avant la CI (non encore en place, cf. arbitrage GitHub Actions/Jenkins).
- **`scripts/constants.js`** : centralise `COMMIT_TYPES` et `EXEMPT_BRANCHES`, partagés par les deux scripts de validation.

## Pièges connus

- **Prisma 7** (7.9) : breaking changes majeurs — plus de `url` dans `schema.prisma` (erreur P1012), connexion via driver adapter (`@prisma/adapter-pg`) passé au constructeur `PrismaClient`, config migrate dans `prisma.config.ts`. À anticiper pour COLLR-412.
- **Swagger UI + Fastify** exige `@fastify/static` (déjà installé).
- Warning au boot « Unsupported route path: /api/* » (LegacyRouteConverter) : bénin, vient du `setGlobalPrefix` avec exclusion — auto-converti par Nest.
- Le dev se fait sous **Windows** (Git Bash + PowerShell) : scripts npm cross-platform uniquement.
- **Husky ne fonctionne pas après un simple `cd backend && npm install`** : il faut aussi `npm install` **à la racine** du repo (installe `husky`/`lint-staged` et déclenche le script `prepare` qui configure `core.hooksPath`). Sans ça, les hooks ne se déclenchent jamais, silencieusement.
- **Doublon dans le backlog Jira** : [COLLR-338](https://collectionr.atlassian.net/browse/COLLR-338) (épic legacy COLLR-16 « API & Backend / Data ») décrit un périmètre quasi identique à celui déjà couvert par COLLR-404/410/411/412 (NestJS+Fastify, ESLint/Prettier/Jest, Prisma, filtre d'exception, Clean Architecture). Sa sous-tâche [COLLR-340](https://collectionr.atlassian.net/browse/COLLR-340) mentionnait explicitement Husky — remplacée en pratique par COLLR-591. À clarifier/fusionner avec l'équipe.

## Environnement local

- **Décision (2026-09-16)** : le provisionnement de PostgreSQL/Redis n'est **plus géré par ce repo** (`docker-compose.yml` supprimé) — c'est la responsabilité de l'équipe DevOps. On ne fait que consommer `DATABASE_URL`/`REDIS_URL` depuis `.env`.
- `backend/.env` local (gitignoré) : identifiants `collectionr`/`collectionr` par défaut si l'instance fournie les reprend, sinon adapter selon l'environnement DevOps.
