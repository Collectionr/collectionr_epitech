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

## ADR-012 — Table `data_retention_policies` sans module applicatif (COLLR-664)

Modèle Prisma `DataRetentionPolicy` → table `data_retention_policies` (colonnes de `docs/database/schema-sql.md` : `id`, `entityType`, `retentionDays`, `description`, `updatedAt`). Données de référence des durées S04 §5 : écrites par le seeder (COLLR-543), lues par le cronjob de suppression (COLLR-544), tous deux hors `backend/`.
**Décisions** :
- **Pas de module Clean Architecture** (ni port, ni repository, ni use case) : aucun code backend ne lit la table. Même principe que COLLR-412/437. Un module sera créé quand un use case en aura besoin.
- **Mêmes conventions que `audit_logs`** : nom de table snake_case pluriel (`@@map`), `id` en `@db.Uuid`, dates en `@db.Timestamptz(6)`.
- **`entityType` unique** : une seule politique par type de donnée. Sinon le cronjob ne saurait pas quelle durée appliquer, et le seeder peut faire un `upsert` idempotent sur `entityType`. Les valeurs sont en snake_case singulier (`account`, `application_log`, `audit_log`…) ; la liste définitive revient au seeder.
- **`retentionDays` est compté depuis l'événement de référence de chaque type** (clôture du compte pour `account`, création pour les logs), pas depuis `updatedAt`.
**Limites connues** :
- Pas de contrainte `CHECK (retentionDays >= 0)` : Prisma ne sait pas la déclarer dans le schéma. À ajouter en SQL dans une migration si un besoin de validation en base apparaît.
- **Deux sources pour la rétention d'audit** : `AUDIT_LOG_RETENTION_DAYS` (variable d'env, calcule `audit_logs.expiresAt` à l'écriture, ADR-011) et la ligne `audit_log` de cette table. Elles doivent rester égales (90 j) jusqu'à ce que COLLR-544 décide laquelle fait foi.

## ADR-013 — Tables RBAC `roles` / `permissions` / `role_permissions` sans module applicatif (COLLR-665)

Modèles Prisma `Role`, `Permission`, `RolePermission` (colonnes de `docs/database/schema-sql.md` : `id` + `name` pour les deux premiers, `roleId` + `permissionId` pour la jointure). Migration `prisma/migrations/20260924132529_add_roles_permissions`. Le RBAC repose sur un modèle relationnel (et non un enum Prisma) pour que `users.roleId` soit une vraie FK dès la création de la table `users` (COLLR-447) — pas de migration enum → FK à prévoir plus tard.
**Décisions** :
- **Mêmes conventions que `audit_logs`** (ADR-011) : tables snake_case pluriel (`@@map`), `id` en `@db.Uuid` + `@default(uuid())`.
- **`Role.name` et `Permission.name` uniques** : un rôle / une permission est identifié par son nom dans le code (jamais par son UUID, qui diffère d'un environnement à l'autre), et le seed fait un `upsert` idempotent dessus.
- **Deux rôles seulement : `USER` et `ADMIN`** (décision du 2026-10-12). `MODERATOR` (« optionnel » dans S03 §5.2 et le CDC) est retiré du seed : il n'a aucun périmètre défini, et le back-office d'administration (CDC §3.5, UC-09/10) n'arrive qu'au jalon V1. Sa réintroduction et ses droits sont à cadrer dans COLLR-679 (matrice des droits). L'ajouter plus tard = une valeur dans `ROLE_NAMES` + une ligne en base, sans migration de structure. Pour l'Alpha, `USER` et `ADMIN` ne diffèrent que par l'obtention du rôle : inscription → `USER`, `ADMIN` attribué hors API.
- **Casse** : rôles en MAJUSCULES (`USER`, `ADMIN`, S03 §5.2 + Jira) ; `documentation-metier.md` les écrivait en minuscules → doc alignée. Permissions au format `ressource:action` en minuscules (`collection:write`, `card:delete` — `documentation-metier.md`).
- **Liste des rôles = constante `ROLE_NAMES`** (+ type `RoleName`) dans `src/shared/config/AppConstants.ts`, partagée entre le seed et les futurs modules Auth (COLLR-447) et RBAC (COLLR-449). Aucune chaîne de rôle en dur ailleurs.
- **`role_permissions`** : clé primaire composite `(roleId, permissionId)` (pas d'`id` technique, empêche les doublons), FK `ON DELETE CASCADE` des deux côtés — supprimer un rôle ou une permission supprime ses associations, jamais l'inverse (vérifié en SQL sur PG16).
- **Pas de permission seedée** : aucune liste n'est définie dans `docs/`. À définir avec l'équipe avant COLLR-449 (TODO dans `project_state.md`).
- **Pas de module Clean Architecture** (ni port, ni repository, ni guard, ni `@Roles`) : aucun code ne lit ces tables. Même principe qu'ADR-012 (COLLR-664). Le contrôle d'accès arrive avec COLLR-449.
- **Pas de relation `User → Role`** : la table `users` n'existe pas encore. COLLR-447 créera `users.roleId` en FK `NOT NULL` → `roles` (rôle `USER` par défaut à l'inscription).
**Question ouverte — rôles insérés par le seed ou par une migration ?**
Pour l'instant les rôles sont écrits par `prisma/seed.ts`. Or, dès COLLR-447, `users.roleId` sera une FK `NOT NULL` : **la ligne `USER` doit exister dans tous les environnements, prod comprise**, sinon aucune inscription ne passe. Aujourd'hui rien ne garantit que le seed tourne en prod : aucune doc de déploiement (`docs/`, `devops/`) ne mentionne `prisma migrate deploy` ni `prisma db seed`, et Prisma 7 ne lance plus le seed automatiquement après `migrate dev` (constaté sur COLLR-665 : `roles` vide après la migration). De plus, `seed.ts` est prévu pour accueillir des données de démo (COLLR-438 : utilisateurs, collections), qui ne doivent **pas** aller en prod — l'exécuter en prod n'est donc pas une solution durable.
**Recommandation** : dans la migration de COLLR-447 (celle qui crée `users`), insérer les rôles de référence en SQL avant de poser la FK — `INSERT INTO "roles" ("id", "name") VALUES (gen_random_uuid(), 'USER'), … ON CONFLICT ("name") DO NOTHING;` (`gen_random_uuid()` est natif depuis PG13). Les migrations sont la seule étape exécutée partout (`migrate deploy`) ; le `ON CONFLICT` rend l'insertion sans effet là où le seed est déjà passé. L'`upsert` du seed peut rester (sans effet si les lignes existent) ou être retiré à ce moment-là — à trancher dans COLLR-447, en gardant `ROLE_NAMES` et la migration synchronisés.


## ADR-014 — Module Auth : algorithme de hachage, politique de mot de passe, frontières domaine/infra (COLLR-414)

Module `src/modules/auth/` (`domain/` + `application/`, sans infrastructure ni endpoint : COLLR-415 les branche).
**Décisions** :
- **bcrypt retenu** comme algorithme de hachage (WBS 3.3, COLLR-510, S04 §2.2). Le CDC et S03 disent « bcrypt ou Argon2 » : le choix est désormais tranché ici. Passer à Argon2 ne change que l'adaptateur de `IPasswordHasher`.
- **Rien de propre à l'algorithme dans `domain/` ni `application/`.** Ce qui en dépend est fourni par le port `IPasswordHasher` : `maxPasswordBytes` (bcrypt ne lit que 72 octets ; `Password.create` reçoit la limite en paramètre, comme `minLength`) et `getDummyHash()` (hash factice au même coût que les vrais, pour que le login d'un compte inconnu prenne autant de temps qu'un compte connu). Une constante écrite dans un use case dérive en silence quand le coût ou l'algorithme change (mesuré : coût 10 = ~64 ms contre coût 12 = ~254 ms).
- **Politique de mot de passe** : 8 caractères minimum (`PASSWORD_MIN_LENGTH`, 8 à 64), au moins une lettre et un chiffre Unicode (`\p{L}`, `\p{Nd}`), pas de caractère nul. **Décision produit à valider par le PO** : le CDC ne fixe aucune règle. Une valeur de politique absente ou invalide fait échouer la création (erreur 5xx), elle ne désactive jamais la règle.
- **Les use cases ne renvoient jamais `passwordHash`** : ils renvoient `UserProfile` (`application/dtos/UserProfile.ts`). Un contrôleur ne peut pas divulguer ce qu'il ne reçoit pas.
- **Comptes désactivés (`isActive`)** : refusés par `Login`, `UpdateProfile` et `ChangePassword` avec la même erreur qu'un compte inconnu. Le refus des tokens (refresh, access) est une obligation du contrat de `IAuthTokenService`, à implémenter en COLLR-415.
- **Messages d'erreur fixes** : `EmailAlreadyUsedError`, `UserNotFoundError` ne reprennent ni l'email ni l'identifiant reçus. `DomainValidationError` est la seule erreur de domaine convertible en 4xx.
- **Email canonique** (NFKC, minuscules, domaine en punycode, sans guillemets ni caractères invisibles) : une boîte mail, un seul compte.
**Points ouverts / suites** :
- **CGU et consentement (retour de relecture, traité en COLLR-414)** : `consentGivenAt` est remplacé par `termsAcceptedAt` + `termsVersion` sur `User`. L'inscription enregistre l'acceptation du contrat (S04 §4 : exécution du contrat), pas un consentement RGPD optionnel ; la table `CONSENT` de `schema-sql.md` reste réservée à ces derniers (Beta). Le client envoie la version qu'il a affichée (`acceptedTermsVersion`), le serveur la compare à `TERMS_VERSION` et refuse une version périmée (`TermsVersionMismatchError`) : c'est la preuve de ce qui a été accepté. `TERMS_VERSION` doit être modifiée à chaque changement des CGU publiées. Reste pour COLLR-415 : colonnes `termsAcceptedAt` / `termsVersion` dans la migration, DTO d'inscription (`acceptedTermsVersion` à la place de `hasAcceptedTerms`).
**Pseudo unique, insensible à la casse (retour de relecture, traité en COLLR-414)** : `User.usernameKey` (NFKC, minuscules, espaces repliés) définit l'égalité de deux pseudos ; `IUserRepository.findByUsername`, vérification dans `RegisterUser` et `UpdateProfile` (changer seulement la casse de son propre pseudo reste permis), `UsernameAlreadyUsedError`, contrat de `save()` (rejet sous concurrence). Reste pour COLLR-415 : la colonne de clé canonique et son index unique, et la traduction de la violation de contrainte en `UsernameAlreadyUsedError`. Les lettres d'autres alphabets qui ressemblent à des lettres latines ne sont pas repliées (il faudrait une table de confusables).
**Désactivation (retour de relecture, traité en COLLR-414)** : `DeactivateUserUseCase` désactive d'abord (plus aucune nouvelle session), puis révoque toutes les sessions du compte ; il est idempotent, donc rejouable si la révocation échoue. Qui peut l'appeler (admin) relève d'un garde de rôle côté interface.

## ADR-015 — Catalogue `licences_tcg` / `sets` / `cards` / `variants` : contrat d'interface possédé par le backend (COLLR-684)

Modèles Prisma `LicenceTCG`, `CardSet`, `Card`, `Variant` → tables `licences_tcg`, `sets`, `cards`, `variants` (migration `prisma/migrations/20261025120000_add_card_catalogue`). Le backend possède le schéma et le migre ; le microservice TCG (Python, psycopg) ne crée ni ne modifie aucune table et n'y écrit que par UPSERT, sur les clés uniques du contrat. Même règle que `docs/microservices/architecture-microservices.md` (PostgreSQL = source de vérité, UPSERT idempotents). Aucun module applicatif (même principe qu'ADR-012/013) : la recherche et l'ajout de carte (COLLR-418, COLLR-407) en créeront un.
**Décisions** :
- **Clés d'UPSERT** : `licences_tcg.slug`, `sets.tcgdexId`, `cards.tcgdexId`, toutes `UNIQUE NOT NULL`, et `variants.(cardId, tcgdexVariantId)` (clé composite, voir plus bas). `tcgdexId` est l'identifiant TCGdex tel quel (`base1`, `swsh3`, `sv03.5`, `swsh3-20`), identique dans toutes les langues. L'`id` UUID reste la clé technique que les futures FK (collection, wishlist) référencent.
- **`id` généré par la base** (`DEFAULT gen_random_uuid()`, `@default(dbgenerated(...))`) et non par `@default(uuid())` comme les tables précédentes : l'UUID de Prisma est produit côté client, donc un `INSERT … ON CONFLICT` en SQL brut devrait en fournir un. Ces tables sont écrites par un autre service, le défaut doit être en base.
- **Une ligne par set et par carte, colonnes `…En` / `…Fr`** (et non une table de traductions). L'anglais est obligatoire, le français optionnel : TCGdex ne couvre le français qu'à ~95 %. Les raretés ne sont pas toutes traduites par TCGdex (`Common` / `Commune`, mais `Holo Rare` dans les deux langues) : on stocke ce qu'il renvoie, sans table de correspondance. La catégorie (`Pokemon` / `Pokémon`) et les types (`Fire` / `Feu`) sont aussi localisés.
- **`number` = `localId` TCGdex, en texte** : zéros initiaux (`006`) et préfixes (`TG01`) à conserver.
- **`types` en `TEXT[]`** (défaut vide) : une carte peut avoir plusieurs types. `hp` nullable. Les cartes Dresseur et Énergie n'ont en général ni l'un ni l'autre, mais TCGdex en renseigne quelques-unes (Fossiles, Poupée Mélo, Énergie Psy de `sv03.5`) : ne pas les supposer toujours vides.
- **Variantes : `variantId` de TCGdex n'est pas une clé à lui seul.** Mesuré sur les 3 sets de référence : 1163 impressions, mais seulement 21 `variantId` distincts partagés entre cartes (les 16 premières cartes de `base1` portent les mêmes quatre, comme les Énergies). Il identifie un *type* d'impression, pas une impression de cette carte : la clé est donc `(cardId, tcgdexVariantId)`, unique dans chaque carte. `variants` porte `type`, `subtype`, `size`, `stamps`, `foil` et les identifiants produit Cardmarket / TCGPlayer / CardTrader (pour rattacher les prix plus tard). Les codes sont stockés **en anglais seulement** (kebab-case) : les libellés français de TCGdex sont en partie non traduits (`thank-you`, `pikachu`). Les drapeaux `variants` de TCGdex (normal, reverse, holo, 1re édition…) ne sont **pas** recopiés sur `cards` : ils ne concordent pas toujours avec le détail (121 cartes sur 510, surtout `base1`) et se déduisent de `variants`.
- **Informations de jeu conservées sur `cards`** : `illustrator`, `dexIds` (numéros du Pokédex national, `INTEGER[]`), `evolveFrom`, `stage`, `trainerType`, `energyType` (en/fr, TCGdex les traduit), `suffix` (identique dans les deux langues), `tcgdexUpdatedAt` (le `updated` de TCGdex). Sur `sets` : série (id + noms en/fr), `abbreviationOfficial` / `abbreviationFr`, `tcgOnlineCode`, décomptes par type d'impression.
- **Écartés à la relecture** : `regulationMark` et la légalité en tournoi (`legal`, cartes et sets), informations de joueur sans usage pour un collectionneur (le CDC exclut le compétitif) ; `energyType` reste, à rediscuter. Pour mémoire, `regulationMark` est la lettre imprimée en bas des cartes récentes (D, G…) qui décide de leur sortie du format Standard.
- **`licences_tcg.logoUrl`** : URL nullable, vide dans le seed (TCGdex ne fournit aucun logo de licence) ; la source reste à choisir, rien n'est stocké localement.
- **Images : URL de base du CDN TCGdex uniquement**, sans extension, par langue (`imageUrlEn`, `imageUrlFr`) ; logos de set par langue, symbole commun. Aucun fichier stocké (CDC, volet propriété intellectuelle : « aucun stockage local d'images »).
- **Clés étrangères en `ON DELETE RESTRICT`** (`sets.licenceTCGId`, `cards.setId`, `variants.cardId`) : un catalogue référencé par des collections ne se vide pas par cascade.
- **Dates et effectifs** : `releaseDate` (type `DATE`) remplace `year` du schéma initial (TCGdex fournit la date complète ; l'année s'en déduit pour le filtre « année » du CDC). `officialCardCount` / `totalCardCount` remplacent `totalCards` (189 / 201 pour `swsh3` : la complétude d'une collection se calcule sur le total).
- **`updatedAt` n'est maintenu que par Prisma** : `@updatedAt` s'exécute côté client. Un UPSERT en SQL brut doit écrire `updatedAt = now()` lui-même (le défaut ne joue qu'à l'insertion).
- **Nom du modèle `CardSet`** : un modèle `Set` masquerait le `Set` global dans le client généré. La table reste `sets`.
- **Hors contrat, volontairement** : prix (`CardPrice`, `PriceHistory`, `ScrapeLog`), détail de jeu très spécifique (`attacks`, `abilities`, `weaknesses`, `resistances`, `retreat`, `description`, `effect`), `predictedPrice` / `priceLowerBound` / `priceUpperBound` (retirés de `CARD`, cf. `docs/database/schema-sql.md`). Toute colonne ajoutée plus tard le sera par une migration additive du backend, annoncée au service TCG.
- **Seed** : `prisma/seed.ts` appelle `prisma/catalogue/SeedCatalogue.ts`, qui UPSERT la licence Pokémon et les 3 sets de référence (`base1`, `swsh3`, `sv03.5` : 510 cartes, 1163 impressions) depuis `prisma/fixtures/tcgdex/` (réponses TCGdex en/fr, sans les prix). Idempotent, donc sans danger en production, comme le seed des rôles. Les 3 sets sont un choix d'implémentation (le ticket ne les nomme pas) : en changer = modifier `REFERENCE_SET_IDS` et régénérer les fichiers (`fixtures/tcgdex/README.md`).
- **Attribution** : licence MIT de TCGdex conservée dans `prisma/fixtures/tcgdex/LICENSE` et citée dans `NOTICE.md` §5.
**Limites connues** :
- **Aucun index de recherche** (nom, trigrammes) : l'autocomplétion < 200 ms P95 est le périmètre de COLLR-418, qui choisira l'index (`pg_trgm` demande l'extension).
- **Tests de migration sans base** : `prisma/catalogue/CardCatalogueMigration.spec.ts` lit le SQL de la migration et fige les clés d'UPSERT (dont la clé composite des variantes), les FK et les colonnes FR/EN ; la CI du backend n'a pas de PostgreSQL. L'application réelle de la migration, l'idempotence du seed et les UPSERT en SQL brut ont été validés le 2026-10-25 contre un PostgreSQL 16 jetable (cf. `project_state.md`).
- **Aucune contrainte `CHECK`** (`officialCardCount <= totalCardCount`, `hp >= 0`) : Prisma ne sait pas les déclarer.

## Couches et responsabilités

| Couche | Rôle | Interdit |
| --- | --- | --- |
| `domain/` | Entités, règles métier | Tout import framework/ORM (règle ESLint) |
| `application/` | Use cases, ports (interfaces + tokens), DTO | Implémentations concrètes |
| `infrastructure/` | Implémentations des ports (Prisma, ioredis, services externes) | Logique métier |
| `interface/` | Controllers, exposition HTTP | Logique métier |
| `src/shared/` | Transverse : config, bootstrap, filtres, pipes, clients infra partagés | Logique métier d'un domaine |
