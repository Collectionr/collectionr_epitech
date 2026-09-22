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
**Statut** : **remplacé par ADR-010 (COLLR-437)**. `PostgresHealthIndicator` (pool `pg`) n'existe plus.

## ADR-010 — Healthcheck via Prisma (driver adapter `@prisma/adapter-pg`)

`PostgresHealthIndicator` est remplacé par `PrismaHealthIndicator`, même port `IHealthIndicator`, même contrat `DependencyHealth`, même timeout 2 s (`runWithTimeout`). La vérification passe par `prismaClient.$queryRaw\`SELECT 1\`` au lieu de `pool.query`. `PostgresModule` (pool `pg` brut) est remplacé par `PrismaModule` (token `PRISMA_CLIENT`), qui instancie `PrismaClient` avec l'adapter `PrismaPg({ connectionString: DATABASE_URL })` — Prisma 7 ne se connecte plus via une `url` dans `schema.prisma` (cf. `.claude/errors/prisma7_url_in_schema.md`).
**Raison** : ADR-004 était explicitement transitoire ; le port `IHealthIndicator` a permis ce remplacement sans toucher `GetHealthStatusUseCase`, `HealthController` ni leurs tests — seul `HealthModule.ts` change de câblage.
**Détails d'implémentation** :
- Client généré dans `src/generated/prisma/` (pas à la racine de `backend/`, pour rester sous le `rootDir` TypeScript de `nest build` — sinon `dist/main.js` se retrouve sous `dist/src/main.js` et casse `start:prod`). Dossier gitignoré, régénéré via `postinstall`/`npm run prisma:generate`.
- `prisma.config.ts` (config migrate, cf. piège Prisma 7) est exclu de `tsconfig.build.json` pour la même raison de `rootDir`.
- Jest a besoin d'un `moduleNameMapper` (`^(\\.{1,2}/.*)\\.js$` → `$1`) : le client généré importe ses propres fichiers internes en NodeNext (extension `.js` explicite sur des `.ts`), que le resolver Jest par défaut ne résout pas.
- Aucun modèle métier dans `schema.prisma` à ce stade (périmètre COLLR-412/437) ; `prisma migrate dev`/`deploy` validés contre une instance PostgreSQL 16 réelle (créent `_prisma_migrations`, aucune migration à générer tant qu'il n'y a aucun modèle).
**Statut** : actif.

## ADR-005 — Config par connection strings, validée au démarrage

`DATABASE_URL` / `REDIS_URL` au format URL (pas de variables éclatées `DB_HOST`/`DB_USER`/…), classe `EnvironmentVariables` validée par class-validator via `ConfigModule.forRoot({ validate })`. L'app **refuse de démarrer** si une variable requise est absente/invalide, en listant les erreurs.
**Raison** : format attendu par Prisma et fourni par les PostgreSQL managés ; fail-fast au boot plutôt que crash à la première requête en prod. Aucun secret n'a de valeur par défaut (`JWT_SECRET` ≥ 32 caractères obligatoire).

## ADR-006 — Format d'erreur API unique

`AllExceptionsFilter` (global, via `APP_FILTER`) renvoie toujours `{ statusCode, error, message, timestamp, path }`. Toute erreur 5xx — non-HTTP **ou** `HttpException` de statut ≥ 500 (ex. `ServiceUnavailableException`) — renvoie un corps générique (`error` = libellé HTTP standard, `message` = « An internal error occurred »). Le vrai message et la stack ne sont que dans les logs serveur. Les 4xx conservent leur message (utile au client).
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

## ADR-011 — Journalisation d'audit par décorateur `@Audit` + interceptor global (COLLR-413)

Module `src/modules/audit/`. Table `audit_logs` (colonnes du schéma `docs/database/schema-sql.md` : `userId`, `action`, `targetType`, `targetId`, `metadata`, `timestamp`, `expiresAt`). Un handler annoté `@Audit({ action, targetType?, targetIdParam?, bodyFields? })` est tracé par `AuditInterceptor` (enregistré en `APP_INTERCEPTOR` par `AuditModule`, sans effet sur les routes non annotées). Tout autre code peut aussi injecter `RecordAuditEntryUseCase`.
**Décisions** :
- **`action` en string libre** au format `domaine.verbe` (validé par `AuditEntry.isValidAction`, et par `@Audit` au démarrage). Un échec est enregistré sous `<action>.failed` avec `statusCode` en metadata — pas de colonne `outcome` (absente du schéma).
- **Écriture synchrone** (le `await` a lieu avant l'envoi de la réponse) ; si elle échoue, l'erreur est **loguée en ERROR et n'interrompt pas** la requête métier (fail-open, choix Alpha : une table d'audit en panne ne doit pas bloquer les connexions). Passer en fail-closed = ne plus attraper l'erreur dans `AuditInterceptor.write`.
- **`metadata` en liste blanche** : seuls les champs de `bodyFields` sont copiés (+ `requestId` pour la corrélation des logs) ; jamais le body brut. `@Audit` refuse au démarrage un champ au nom sensible (`password`, `token`, `secret`… — `domain/rules/SensitiveFields.ts`). Règle S05 §6.
- **`expiresAt`** = `timestamp` + `AUDIT_LOG_RETENTION_DAYS` (défaut 90 j, S04) calculé à l'écriture par `AuditEntry.record`.
- **`userId` nullable, sans FK** : la table `users` n'existe pas encore, et les connexions ratées sont anonymes. L'interceptor lit `request.user.id` (uuid) quand il existe. COLLR-442 ajoutera la FK (`ON DELETE SET NULL`, pour qu'une suppression de compte RGPD ne détruise pas la trace).
- **Journal en ajout seul** : le port `IAuditLogRepository` n'expose que `record`.
- **Rejets de guard (401/403/429) capturés malgré tout** : un interceptor NestJS ne s'exécute jamais quand un guard rejette une requête (guards → interceptors dans le pipeline). `AuditContextGuard` (global, enregistré **avant** `ThrottlerGuard` dans `AppModule` — l'ordre des `APP_GUARD` compte) se contente d'observer et de poser les options `@Audit` sur la requête si la route en porte. `AllExceptionsFilter` — seul point du pipeline exécuté après *n'importe quel* guard — consomme ce marqueur et enregistre `<action>.failed` si présent. `AuditInterceptor` consomme (et efface) le même marqueur dès qu'il s'exécute, donc jamais de double-écriture entre les deux chemins. `writeAuditEntry` (`modules/audit/interface/WriteAuditEntry.ts`) factorise l'écriture + le fail-open entre les deux. **Conséquence assumée** : `shared/interface/filters/AllExceptionsFilter.ts` dépend désormais de `modules/audit/` — inversion volontaire de la couche `shared`, acceptée pour garder un seul filtre source de vérité du format d'erreur (ADR-006) plutôt que d'empiler plusieurs `APP_FILTER` globaux (comportement non garanti par NestJS quand plusieurs filtres globaux matchent la même exception).
- **`metadata` : défense en profondeur par forme de valeur.** En plus de la liste blanche `bodyFields` et du refus au démarrage des noms de champs sensibles (`SensitiveFields.ts`, élargi : `apiKey`, `pin`, `cvv`, `ssn`, `iban`), `ReadAuditContext.ts` redige (`"[redacted]"`) toute valeur qui *ressemble* à un JWT ou à un hash bcrypt/argon2, **quel que soit le nom du champ whitelisté**. Ça ne couvre pas tout (un champ nommé innocemment mais contenant un secret arbitraire sans forme reconnaissable resterait visible) — mais ça retire la dépendance totale à la vigilance du développeur pour les deux cas les plus probables (un token ou un hash qui traîne dans un champ autorisé par erreur).
**Limite connue restante** : la **purge** des entrées expirées n'est pas implémentée (déclencheur à trancher avec Cloud/DevOps, cf. `project_state.md`).

## Couches et responsabilités

| Couche | Rôle | Interdit |
| --- | --- | --- |
| `domain/` | Entités, règles métier | Tout import framework/ORM (règle ESLint) |
| `application/` | Use cases, ports (interfaces + tokens), DTO | Implémentations concrètes |
| `infrastructure/` | Implémentations des ports (Prisma, ioredis, services externes) | Logique métier |
| `interface/` | Controllers, exposition HTTP | Logique métier |
| `src/shared/` | Transverse : config, bootstrap, filtres, pipes, clients infra partagés | Logique métier d'un domaine |
