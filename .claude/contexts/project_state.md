# État du projet — à maintenir entre sessions

> Mettre à jour ce fichier quand un ticket est terminé, une décision prise, ou un piège découvert.

_Dernière mise à jour : 2026-09-17 (COLLR-438 — scaffolding du script de seed)_

## Fait

- **COLLR-410** — Init projet backend + standards qualité (mergé sur `main`)
- **COLLR-411** — Bootstrap applicatif, 9 sous-tâches (COLLR-428→436) : validation env, `/api/v1`, ValidationPipe durci, filtre d'exception, CORS, Throttler, pino, `/health` réel (pg + ioredis), Swagger complet, Helmet.
  Branche `COLLR-411/feat/bootstrap-applicatif`, un commit par sous-tâche. Validé de bout en bout en local (200 ok avec Postgres/Redis disponibles, 503 degraded sans). Re-vérifié le 2026-09-16 : lint clean, 34 tests unitaires + 16 e2e OK, couverture 96,29 %. Sous-tâches 428→436 assignées à Alexis Ferrere et passées "En cours" dans Jira ; le ticket COLLR-411 lui-même reste "En cours" côté Jira (pas encore transitionné en "Terminé"). **PR #47 ouverte vers `dev`, pas encore mergée** au moment où COLLR-437 démarre (cf. ci-dessous).
- **Outillage Git (Husky)** — hooks `pre-commit`/`commit-msg`/`pre-push` mis en place à la racine du monorepo, cf. section dédiée ci-dessous. Ticket [COLLR-591](https://collectionr.atlassian.net/browse/COLLR-591) (sous-tâche de COLLR-411).
- `main.ts` affiche désormais l'URL de l'app, du healthcheck et de Swagger au démarrage (`Logger.log`), pour éviter la confusion "pas de localhost affiché".
- **COLLR-437** — Installation et connexion Prisma/PostgreSQL (sous-tâche de COLLR-412), branche `COLLR-412/feat/setup-prisma-postgresql` **créée depuis `COLLR-411/feat/bootstrap-applicatif`** (pas depuis `dev`, car la PR #47 n'était pas encore mergée et COLLR-412 dépend directement de ses livrables : `EnvironmentVariables.ts`, port `IHealthIndicator`, ADR-004). Prisma 7.10 installé (`@prisma/client`, `@prisma/adapter-pg`, `prisma`), `pg`/`@types/pg` retirés des dépendances directes (restent en transitif via `@prisma/adapter-pg`). `PostgresHealthIndicator`/`PostgresModule` remplacés par `PrismaHealthIndicator`/`PrismaModule` (ADR-010) — aucun changement de `GetHealthStatusUseCase`/`HealthController`/leurs tests. Aucun modèle métier dans `schema.prisma` (hors périmètre). `prisma migrate dev`/`deploy` validés contre une vraie instance PostgreSQL 16 locale temporaire (non conservée). Lint clean, 34 tests unitaires + 16 e2e OK, couverture 96,27 %, build OK, smoke-test de l'app compilée OK (`/health` : 200 avec DB réelle connectée, 503 sans).
- **COLLR-438** — Scaffolding du script de seed (sous-tâche de COLLR-412). Volontairement minimal : `prisma/seed.ts` se connecte (Prisma + adapter-pg) et exécute `SELECT 1` pour valider le câblage, sans données de démo — aucun modèle métier n'existe encore (Users/Collection/CardEntry/Catalogue sont portés par des epics fonctionnels non démarrés), donc rien à seeder pour l'instant. À remplir progressivement, epic par epic. Câblé via `prisma.config.ts` (`migrations.seed`) et `npm run prisma:seed`. A nécessité un contournement supplémentaire (`prisma/registerGeneratedClientResolution.js`, cf. piège ci-dessous) : `ts-node` seul ne résout pas les imports `.js` du client Prisma généré (contrairement à `nest build`/Jest). Lint clean, build OK, 34 tests unitaires + 16 e2e OK, couverture inchangée (96,27 %), `prisma:seed` testé (échec propre ECONNREFUSED sur un host injoignable, confirmant que la connexion réelle est bien tentée).

## En cours / à venir

- **COLLR-412** — Setup base de données (outillage Prisma/PostgreSQL). COLLR-437 et COLLR-438 faits (ci-dessus). COLLR-439 (revue finale migrations/indexation) supprimé du backlog Jira par l'utilisateur le 2026-09-17 — jugé non pertinent tant que les epics fonctionnels (Auth, Collection, Catalogue) n'ont pas démarré ; à recréer si besoin une fois ces epics avancés.
- Epic Authentification — inclut le rate limiting renforcé login/register (ADR-008) et le schéma Bearer JWT déjà déclaré dans Swagger (`access-token`).
- CI/CD : arbitrage GitHub Actions vs Jenkins non tranché avant Alpha (équipe Cloud & Cyber).
- Nettoyer les fichiers Husky encore non commités sur `COLLR-411/feat/bootstrap-applicatif` : `.husky/pre-commit` (check de branche), `scripts/verify-branch-name.js`, `scripts/constants.js`, refactor de `scripts/verify-commit-msg.js`.
- **COLLR-411 (PR #47) toujours pas mergée** au moment de COLLR-437 : la branche `COLLR-412/feat/setup-prisma-postgresql` est en aval de `COLLR-411/feat/bootstrap-applicatif`, pas de `dev`. Comme les merges precédents sur ce repo sont de vrais merge commits (pas de squash), le merge de la PR #47 puis de celle de COLLR-412 devrait rester propre — mais à surveiller.

## Modules existants

| Module | Rôle | Notes |
| --- | --- | --- |
| `src/modules/health` | Healthcheck DB + Redis | **Exemple de référence** des 4 couches + ports |
| `src/shared` | Socle transverse | config, bootstrap, filtres, pipes, `PrismaModule`/`RedisModule` |

## Outillage Git (Husky)

Racine du monorepo (pas dans `backend/`) : `package.json` + `package-lock.json` racine (devDependencies `husky`, `lint-staged`), `.husky/`, `scripts/`.

- **`pre-commit`** : vérifie le nom de la branche courante (`scripts/verify-branch-name.js`, format `COLLR-xxx/type/description`, `main`/`dev` exemptées) puis lance `lint-staged` (`backend/.lintstagedrc.json`, ESLint `--fix` + Prettier sur les `.ts` staged de `backend/`, via `--cwd backend`).
- **`commit-msg`** : `scripts/verify-commit-msg.js` valide le format `type: description` ou `type(dossier): description` (types conventional commits). La clé Jira en suffixe n'est **plus obligatoire** (décision explicite en session, cf. `git log` sur `scripts/verify-commit-msg.js`) — CLAUDE.md à surveiller si ce point est recontesté.
- **`pre-push`** : `npm run lint && npm run test:cov` dans `backend/` — seul filet avant la CI (non encore en place, cf. arbitrage GitHub Actions/Jenkins).
- **`scripts/constants.js`** : centralise `COMMIT_TYPES` et `EXEMPT_BRANCHES`, partagés par les deux scripts de validation.

## Pièges connus

- **Prisma 7** (confirmé en 7.10) : breaking changes majeurs — plus de `url` dans `schema.prisma` (erreur P1012), connexion via driver adapter (`@prisma/adapter-pg`) passé au constructeur `PrismaClient`, config migrate dans `prisma.config.ts` (le CLI génère parfois `prisma7.config.ts` par défaut selon la version — renommer en `prisma.config.ts` fonctionne, le CLI le retrouve sans option supplémentaire).
- **Générateur Prisma 7 (`provider = "prisma-client"`) et `rootDir` TypeScript** : si le client est généré à la racine de `backend/` (`generated/prisma`, valeur par défaut de `prisma init`), il devient un sibling de `src/` et `nest build`/`tsc` recalcule un `rootDir` commun englobant les deux → `dist/main.js` se retrouve sous `dist/src/main.js`, ce qui casse `start:prod` (`node dist/main`). **Solution** : générer sous `src/generated/prisma` (`generator client { output = "../src/generated/prisma" }`), gitignoré (`/src/generated/prisma`), et exclure `src/generated/**` du lint (`eslint.config.mjs` → `ignores`) et de Prettier (`.prettierignore`). Même souci avec `prisma.config.ts` à la racine de `backend/` : à exclure explicitement de `tsconfig.build.json` (`exclude: [..., "prisma.config.ts"]`), sinon même casse de `rootDir`.
- **Jest + client Prisma généré (NodeNext)** : le client généré importe ses fichiers internes avec extension `.js` explicite sur des fichiers `.ts` (convention NodeNext). Le resolver Jest par défaut ne résout pas `.js` → `.ts` : `Cannot find module '.../client.js'`. Nécessite `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` dans `jest.config.js` **et** `test/jest-e2e.json`.
- **Couverture Jest et code généré** : sans exclusion, `src/generated/prisma/**` (jamais testé, généré) fait chuter la couverture globale sous le seuil de 70 %. Ajouter `src/generated/` à `coveragePathIgnorePatterns`.
- **`ts-node` seul ne résout pas les imports `.js` du client Prisma généré** (contrairement à `nest build`/Jest) — bloque tout script ad-hoc comme `prisma/seed.ts`. Détail et solution (hook de résolution CommonJS) : `.claude/errors/prisma7_ts-node_js_extension_resolution.md`.
- **`npx prisma init` (CLI récent) installe des « skills » IA** (`.claude/skills/`, `.windsurf/skills/`, `.agents/skills/`, `skills-lock.json`) à la racine de `backend/` — sans rapport avec le projet, à supprimer après `prisma init`.
- **Swagger UI + Fastify** exige `@fastify/static` (déjà installé).
- Warning au boot « Unsupported route path: /api/* » (LegacyRouteConverter) : bénin, vient du `setGlobalPrefix` avec exclusion — auto-converti par Nest.
- Le dev se fait sous **Windows** (Git Bash + PowerShell) : scripts npm cross-platform uniquement.
- **Husky ne fonctionne pas après un simple `cd backend && npm install`** : il faut aussi `npm install` **à la racine** du repo (installe `husky`/`lint-staged` et déclenche le script `prepare` qui configure `core.hooksPath`). Sans ça, les hooks ne se déclenchent jamais, silencieusement.
- **Doublon dans le backlog Jira** : [COLLR-338](https://collectionr.atlassian.net/browse/COLLR-338) (épic legacy COLLR-16 « API & Backend / Data ») décrit un périmètre quasi identique à celui déjà couvert par COLLR-404/410/411/412 (NestJS+Fastify, ESLint/Prettier/Jest, Prisma, filtre d'exception, Clean Architecture). Sa sous-tâche [COLLR-340](https://collectionr.atlassian.net/browse/COLLR-340) mentionnait explicitement Husky — remplacée en pratique par COLLR-591. À clarifier/fusionner avec l'équipe.

## Environnement local

- **Décision (2026-09-16)** : le provisionnement de PostgreSQL/Redis n'est **plus géré par ce repo** (`docker-compose.yml` supprimé) — c'est la responsabilité de l'équipe DevOps. On ne fait que consommer `DATABASE_URL`/`REDIS_URL` depuis `.env`.
- `backend/.env` local (gitignoré) : identifiants `collectionr`/`collectionr` par défaut si l'instance fournie les reprend, sinon adapter selon l'environnement DevOps.
- Validation COLLR-437 : PostgreSQL 16 installé nativement dans l'environnement de session (pas de Docker), utilisé le temps de valider `prisma migrate dev`/`deploy` en conditions réelles, puis base supprimée et service arrêté (rien de persistant, aucune infra ajoutée au repo).
