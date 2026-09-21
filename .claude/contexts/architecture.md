# Architecture backend — Décisions (ADRs)

Règle de dépendance absolue (détail dans `docs/backend/clean-architecture.md`) :

```
interface → application → domain
                ↑
         infrastructure (implémente les ports de application/)
```

## ADR-001 — Fastify plutôt qu'Express

Adaptateur `@nestjs/platform-fastify`.
**Raison** : SLA API < 200 ms P95 (CDC) ; Fastify est sensiblement plus rapide et son logger natif est pino — cohérent avec le logging structuré.
**Conséquence** : accès natif `@Res()` interdit sauf nécessité documentée (cf. conventions) ; les plugins sont des packages `@fastify/*`.

## ADR-002 — Socle transverse centralisé dans `configureApp()`

Toute la configuration d'app (préfixe, versioning, pipes, CORS, Helmet, Swagger) vit dans `src/shared/bootstrap/ConfigureApp.ts`, appelée par `main.ts` **et** par chaque test e2e.
**Raison** : les e2e exercent exactement la configuration de production ; aucun endpoint ne peut « oublier » une garantie du socle.

## ADR-003 — `/health` hors préfixe `/api/v1`

`setGlobalPrefix('api', { exclude: ['health'] })` + `VERSION_NEUTRAL` sur le controller.
**Raison** : les Liveness/Readiness Probes K3s (équipe Cloud & Cyber) ciblent une URL stable, indépendante du versioning API.

## ADR-004 — Healthcheck via ports + clients légers (pré-Prisma)

`/health` vérifie la connexion effective : `SELECT 1` (pool `pg`) et `PING` (ioredis), timeout 2 s, latence mesurée. Les vérifications passent par le port `IHealthIndicator` (token `HEALTH_INDICATORS`).
**Raison** : l'outillage Prisma est porté par COLLR-412 — hors périmètre du socle (COLLR-411). Grâce au port, brancher Prisma = remplacer `PostgresHealthIndicator`, sans toucher use case, controller ni tests.
**Statut** : transitoire, à revisiter avec COLLR-412/437.

## ADR-005 — Config par connection strings, validée au démarrage

`DATABASE_URL` / `REDIS_URL` au format URL (pas de variables éclatées `DB_HOST`/`DB_USER`/…), classe `EnvironmentVariables` validée par class-validator via `ConfigModule.forRoot({ validate })`. L'app **refuse de démarrer** si une variable requise est absente/invalide, en listant les erreurs.
**Raison** : format attendu par Prisma et fourni par les PostgreSQL managés ; fail-fast au boot plutôt que crash à la première requête en prod. Aucun secret n'a de valeur par défaut (`JWT_SECRET` ≥ 32 caractères obligatoire).

## ADR-006 — Format d'erreur API unique

`AllExceptionsFilter` (global, via `APP_FILTER`) renvoie toujours `{ statusCode, error, message, timestamp, path }`. Toute erreur 5xx — non-HTTP **ou** `HttpException` de statut ≥ 500 (ex. `ServiceUnavailableException`) — renvoie un corps générique (`error` = libellé HTTP standard, `message` = « Une erreur interne est survenue »). Le vrai message et la stack ne sont que dans les logs serveur. Les 4xx conservent leur message (utile au client).
**Raison** : contrat stable pour le frontend quel que soit le domaine ; aucune fuite de détail interne (retour de review PR COLLR-411 : une `HttpException` 5xx renvoyait auparavant son message tel quel) ; les erreurs du ValidationPipe (tableau `message[]`) sont préservées.

## ADR-007 — Logs JSON via nestjs-pino

JSON une ligne/événement hors développement, `pino-pretty` en dev, niveau par `LOG_LEVEL`, redaction de `authorization`/`cookie`/`set-cookie`.
**Raison** : base exploitable par Grafana/Loki (observabilité portée par Cloud & Cyber) ; pino est le logger natif de Fastify (quasi zéro overhead).

## ADR-008 — Rate limiting à deux niveaux

Throttler global (`THROTTLE_TTL`/`THROTTLE_LIMIT`, guard `APP_GUARD`) comme filet de sécurité ; le rate limiting renforcé de `/login` et `/register` sera porté par l'Epic Authentification (stockage Redis, pas en mémoire).
**Raison** : protection de base immédiate sur toute l'API sans attendre l'auth.

## ADR-009 — CSP Helmet assouplie uniquement si Swagger UI exposé

`@fastify/helmet` global ; quand `SWAGGER_ENABLED=true`, la CSP autorise les scripts/styles inline requis par Swagger UI. En production (Swagger désactivé), CSP stricte par défaut.
**Raison** : ne pas dégrader la posture sécurité prod pour un outil de dev.

## Couches et responsabilités

| Couche | Rôle | Interdit |
| --- | --- | --- |
| `domain/` | Entités, règles métier | Tout import framework/ORM (règle ESLint) |
| `application/` | Use cases, ports (interfaces + tokens), DTO | Implémentations concrètes |
| `infrastructure/` | Implémentations des ports (pg, ioredis, services externes) | Logique métier |
| `interface/` | Controllers, exposition HTTP | Logique métier |
| `src/shared/` | Transverse : config, bootstrap, filtres, pipes, clients infra partagés | Logique métier d'un domaine |
