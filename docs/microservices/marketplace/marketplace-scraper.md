# Microservice TCG — collecte des cartes et des prix

## Vue d'ensemble

Ce document décrit la conception du **Microservice TCG** du projet CollectionR et de ses **workers**,
conformément à l'architecture runtime ([03-flux-techniques-plateforme.md](../../architecture/03-flux-techniques-plateforme.md)).

Son rôle est de **synchroniser les métadonnées de cartes** et de **collecter les prix de marché**
des cartes Pokémon TCG, puis de les stocker dans PostgreSQL.

> **Important** : le Microservice TCG et ses workers sont des **composants d'arrière-plan**. Ils
> n'exposent **aucune API REST aux clients**. Seul le backend **NestJS (sur adaptateur Fastify)**
> expose des endpoints publics. L'**orchestrateur** (Microservice TCG) expose toutefois un unique
> endpoint **REST interne** (**FastAPI**, `POST /sync`) appelé uniquement par le backend ; les
> **workers**, eux, n'exposent rien du tout. Les workers sont écrits en **Python** (cohérent avec le
> Pipeline de Données Python décrit dans [clean-architecture.md](../../backend/clean-architecture.md)).

---

# 1. Périmètre et workers

Le Microservice TCG **orchestre trois workers** via une file Redis dédiée (`Redis TCG`) :

| Worker | Rôle | Sources |
|--------|------|---------|
| **Worker TCG API** | Synchronise les **métadonnées** et les **prix agrégés** | TCGdex (niveau 1) — catalogue FR + EN |
| **Worker TCG Scraping** | Interroge PokeTrace, eBay Browse API et TCGFast quand TCGdex est indisponible | PokeTrace (niv. 2) → eBay Browse API (niv. 3) → TCGFast Trader (niv. 4) |
| **Worker TCG Prediction** | Prédit/estime des prix (IA) à partir de l'historique | Service Python `/predict-price` (cf. clean-architecture) |

> **Note sur le Worker TCG Scraping.** Malgré son nom, ce worker ne réalise **aucun scraping**. Il
> appelle exclusivement les APIs officielles de niveau 2 (PokeTrace), niveau 3 (eBay Browse) et
> niveau 4 (TCGFast) en relais de TCGdex.

---

# 2. Architecture globale

## Position dans le système

```
                         CLIENTS (web / mobile)
                                  │  HTTP (REST + SSE)
                                  ▼
                  BACKEND NESTJS (adaptateur Fastify)
                 API · auth · LECTURE des prix en base
                                  │  requête REST HTTP (POST /sync)
                                  ▼
                   MICROSERVICE TCG (orchestrateur, FastAPI)
                                  │  distribue les tâches via Redis TCG (Streams)
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                          ▼
 ┌──────────────┐        ┌──────────────────┐      ┌──────────────────┐
 │ Worker TCG   │        │ Worker TCG       │      │ Worker TCG       │
 │ API (Python) │        │ Fallback (Python) │      │ Prediction (Py)  │
 └──────┬───────┘        └────────┬─────────┘      └────────┬─────────┘
        │ TCGdex (niv. 1)        │ PokeTrace+eBay+TCGFast  │ modèle IA
        ▼                         ▼  (niv. 2 + 3 + 4)      │ (sur historique)
 ┌──────────────┐        ┌──────────────────┐               │
 │ TCGdex       │        │ PokeTrace (n.2)  │               │
 │ api.tcgdex.  │        │ eBay Browse (n.3)│               │
 │ net  FR+EN   │        │ TCGFast (n.4)    │               │
 └──────┬───────┘        └────────┬─────────┘               │
        │ ÉCRITURE                │ ÉCRITURE                 │ ÉCRITURE
        │ (psycopg 3)             │ (psycopg 3)              │ (psycopg 3)
        └─────────────────────────┼──────────────────────────┘
                                  ▼
                  ┌────────────────────────────────────┐
                  │             PostgreSQL              │ ◀── LECTURE ── Backend
                  │  cartes · prix · historique · logs  │
                  └────────────────────────────────────┘
```

> **Tous les workers écrivent dans PostgreSQL** via `psycopg 3` (UPSERT idempotents). PostgreSQL
> est l'**unique source de vérité** ; le backend NestJS y **lit les prix**, et les **écritures** sur
> les tables de prix sont réservées aux workers.

## Responsabilités

| Responsabilité | Worker | Description |
|----------------|--------|-------------|
| Synchronisation cartes | TCG API | Métadonnées + images (URLs uniquement) |
| Collecte des prix — niv. 1 | TCG API | Prix agrégés Cardmarket/TCGPlayer via TCGdex |
| Collecte des prix — niv. 2-4 | TCG Scraping | PokeTrace → eBay Browse → TCGFast si TCGdex indisponible |
| Estimation de prix | TCG Prediction | Modèle IA sur l'historique |
| Normalisation | tous | Devise → EUR, état, **langue**, noms |
| Stockage | tous | Écriture idempotente en PostgreSQL |

> **Cache PostgreSQL permanent :** si les trois sources externes sont simultanément indisponibles,
> le backend sert les **dernières valeurs connues** avec l'horodatage. Aucune erreur bloquante.

---

# 3. Sources de données (réalité 2026)

L'audit de juin 2026 a établi l'état réel d'accès aux sources. La stratégie en découle.

| Source | Type | Accès | Usage CollectionR |
|--------|------|-------|-------------------|
| **TCGdex** | API ouverte | Gratuit, sans clé, licence MIT | **Niveau 1 — Principal** : métadonnées + prix agrégés (CM €, TCGP $) ; catalogue FR + EN |
| **PokeTrace** | API dédiée TCG | Freemium 250 req/j, Pro 10 000 req/j | **Niveau 2 — Fallback EUR** : prix EUR Cardmarket + USD TCGPlayer/eBay, par état et grade |
| **eBay Browse API** | API officielle | OAuth, programme dev eBay, clé gratuite | **Niveau 3 — Complément USD** : annonces actives uniquement |
| **TCGFast Trader** | API dédiée TCG | 14,99 $/mois, usage commercial OK, SDK Python | **Niveau 4 — Fallback payant** : prix TCGPlayer + eBay + PSA/BGS/CGC + historique |
| **Cache PostgreSQL** | Base locale | — | **Filet permanent** : dernières valeurs connues + horodatage |
| **pokemontcg.io** | API | Migré vers Scrydex, payant | **Écarté** : supprimé |
| **Cardmarket** | API | Vendeurs pro, approbation manuelle | **Écarté** : CGU interdisent l'usage tiers |
| **TCGPlayer** | API | **Fermée aux nouveaux dev** (fin 2024) | **Écarté** : inaccessible + ToS |

> **Conséquence clé :** les prix Cardmarket et TCGPlayer sont **déjà fournis légalement** par TCGdex.
> PokeTrace assure le premier fallback avec les prix EUR Cardmarket par état et grade. TCGFast
> complète avec les prix eBay réels et les gradations PSA/BGS/CGC. Cardmarket et TCGPlayer sont
> protégés par **Cloudflare Enterprise** — leur scraping est à la fois interdit par CGU et inutile.

---

# 4. Stratégie de collecte (cascade API 3 niveaux)

Cascade par ordre de priorité (cf. [decision-technique.md](decision-technique.md)) :

1. **TCGdex (niveau 1 — principal)** — `Worker TCG API` interroge TCGdex pour les métadonnées et
   les prix agrégés Cardmarket (EUR) + TCGPlayer (USD) avec historique avg1/avg7/avg30. Catalogue
   **français (FR) et anglais (EN)** dès la V1. Toujours consulté en premier.
2. **PokeTrace (niveau 2 — fallback EUR)** — `Worker TCG Scraping`, activé si TCGdex est
   indisponible. Fournit prix EUR Cardmarket + USD TCGPlayer/eBay avec **ventilation par état** (NM,
   LP…) et **grade** (PSA/BGS/CGC). Freemium 250 req/jour ; plan Pro 10 000 req/jour.
   Clé : `POKETRACE_API_KEY` en Secrets Kubernetes.
3. **eBay Browse API (niveau 3 — complément USD)** — `Worker TCG Scraping`, annonces actives via
   OAuth ; utilisé si TCGdex et PokeTrace sont simultanément indisponibles.
4. **TCGFast Trader (niveau 4 — fallback payant)** — `Worker TCG Scraping`, plan Trader 14,99 $/mois.
   Apporte : prix eBay (ventes réelles), **prix gradués PSA/BGS/CGC**, historique. SDK Python. Activé
   uniquement si niveaux 1, 2 et 3 sont simultanément indisponibles. Clé : `TCGFAST_API_KEY`.
5. **Cache PostgreSQL (filet de sécurité permanent)** — si les 4 sources sont indisponibles, le
   backend sert les dernières valeurs connues avec horodatage, sans erreur bloquante.

---

# 5. Planification des tâches (Cron / REST + Redis Streams)

La planification est **déclenchée** par le backend NestJS (cron), via un **appel REST HTTP** vers
l'endpoint **FastAPI** du **Microservice TCG** (`POST /sync`) ; celui-ci publie ensuite les tâches
par rôle sur **Redis TCG (Redis Streams)**, et chaque worker Python les **consomme** via son propre
consumer group (`XREADGROUP`/`XACK`).

Rappel de la syntaxe cron (5 champs) :

```
┌───── minute (0-59)
│ ┌───── heure (0-23)
│ │ ┌───── jour du mois (1-31)
│ │ │ ┌───── mois (1-12)
│ │ │ │ ┌───── jour de la semaine (0-6, 0=dimanche)
* * * * *
```

| Expression     | Signification             |
|----------------|---------------------------|
| `0 * * * *`    | Toutes les heures         |
| `0 6 * * *`    | Tous les jours à 6h00     |
| `*/30 * * * *` | Toutes les 30 minutes     |
| `0 0 * * 1`    | Tous les lundis à minuit  |

### Fréquence retenue

Une **synchronisation complète une fois par jour** :

```
Toutes les cartes  →  1 fois par jour (cron `0 3 * * *`, à 3 h du matin)
```

> L'exécution à 3 h du matin minimise l'impact sur les sources externes et lisse la charge.

---

# 6. Modèle de données

> Le **schéma est la propriété du backend NestJS (Prisma)** ; le worker Python écrit via `psycopg 3`
> avec des **UPSERT idempotents**. Les deux représentations doivent rester strictement alignées.

### Table `CardPrice` — prix actuel

```prisma
model CardPrice {
  id         String   @id @default(uuid())
  cardId     String
  source     String   // "tcgdex" | "ebay" | "tcgfast"
  condition  String   // "NM", "LP", "MP", "HP", "DMG", "PSA10"...
  language   String   // "EN", "FR", "JP" — fait partie de l'identité du prix
  currency   String   @default("EUR")
  price      Decimal  @db.Decimal(10, 2)
  url        String?
  scrapedAt  DateTime @default(now())

  @@unique([cardId, source, condition, language])
  @@map("card_prices")
}
```

### Table `PriceHistory` — historique

```prisma
model PriceHistory {
  id         String   @id @default(uuid())
  cardId     String
  source     String
  condition  String
  language   String
  currency   String   @default("EUR")
  price      Decimal  @db.Decimal(10, 2)
  recordedAt DateTime @default(now())

  @@index([cardId, source, language])
  @@map("price_history")
}
```

> **La langue fait partie de l'identité d'un prix.** Une même carte vaut très différemment selon sa
> langue (ex. Charizard VMAX `swsh3-20` ≈ 45 € en EN, ≈ 8 € en JP). Le champ `language` est donc
> inclus dans la **contrainte d'unicité** ; l'omettre provoquerait des collisions et des pertes de
> données.

### Table `CollectLog` — suivi des collectes

```prisma
model CollectLog {
  id         String    @id @default(uuid())
  cardId     String?
  source     String    // "tcgdex" | "ebay" | "tcgfast" | "cache"
  method     String    // "api"
  status     String    // "success" | "error" | "skipped" | "cache_hit"
  errorMsg   String?
  startedAt  DateTime  @default(now())
  finishedAt DateTime?

  @@map("collect_logs")
}
```

---

# 7. Normalisation des données

Une carte correctement normalisée possède : une **devise commune (EUR)**, un **état standardisé**,
et une **langue identifiée**.

## 7.1 États (conditions)

États standardisés : **MINT, NM, LP, MP, HP, DMG, PSA10, PSA9**. Chaque source est mappée vers ce
référentiel (ex. « Near Mint » → `NM`, « Lightly Played » → `LP`).

## 7.2 Devises

Toutes les devises sont converties en **EUR** (référence). La conversion USD→EUR s'appuie sur une
API de taux de change, avec taux mis en cache et rafraîchis périodiquement.

> La conversion en EUR **unifie les montants** mais ne suffit pas à comparer deux cartes : la
> **langue** et l'**état** doivent être identiques. D'où la présence du champ `language`.

## 7.3 Langue

Valeurs normalisées : `EN`, `FR`, `JP`… Conservée dans chaque enregistrement de prix et dans la clé
d'unicité (voir §6).

## 7.4 Noms de cartes

Mise en minuscules, suppression des accents/diacritiques et caractères spéciaux, espaces superflus
(ex. `"Dracaufeu"` → `"dracaufeu"`).

> La validation et la normalisation s'appuient sur **`pydantic`** côté worker Python.

---

# 8. Logs et gestion des erreurs

Niveaux standards : `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. Chaque tentative de collecte
donne lieu à une entrée `CollectLog`. En cas d'échec de toutes les sources, le backend continue de
servir la **dernière donnée disponible** : aucun blocage de service. K3s **redémarre automatiquement**
un Pod défaillant.

---

# 9. Intégration avec le backend NestJS

- Le backend **NestJS (Fastify)** déclenche la planification (cron) et **lit** les prix en base.
- Le backend envoie une **requête REST HTTP** (`POST /sync`) à l'endpoint **FastAPI** du
  **Microservice TCG** (orchestrateur), qui publie les tâches par rôle sur **Redis TCG (Redis
  Streams)**.
- Les **workers Python consomment** leur stream dédié (lib `redis-py`, consumer groups
  `XREADGROUP`/`XACK`) et **écrivent** en PostgreSQL via `psycopg 3`.
- La collecte n'est **jamais** déclenchée par une requête utilisateur.

```
Client ──▶ GET /market/swsh3-20 ──▶ Backend NestJS ──▶ lecture PostgreSQL
                                                   │
                            données présentes ─────┴──▶ réponse
                            cache périmé ──▶ réponse avec horodatage + message informatif
```

| Composant | Rôle |
|-----------|------|
| Microservice TCG | Reçoit le déclenchement REST du backend (**FastAPI**), orchestre les workers via Redis TCG |
| Worker TCG API | Collecte via TCGdex (niveau 1), écrit en base |
| Worker TCG Scraping | Collecte via PokeTrace + eBay Browse + TCGFast (niveaux 2-4), écrit en base |
| Worker TCG Prediction | Estime les prix (IA), écrit en base |
| Backend NestJS (Fastify) | Expose les endpoints, lit les données |
| PostgreSQL | Source de vérité des prix + cache permanent |
| Redis TCG | Redis Streams (planification par rôle), pas de stockage de prix |

> **Redis TCG** utilise des **Redis Streams** natifs : `ioredis` (Node, côté backend/orchestrateur si
> besoin) et `redis-py` (Python, côté workers) parlent tous les deux le protocole Redis directement.

---

# 10. Alignement K3s (architecture runtime)

Conformément à [03-flux-techniques-plateforme.md](../../architecture/03-flux-techniques-plateforme.md),
chaque composant est un **Pod K3s** :

- **Deployments** distincts pour `Worker TCG API`, `Worker TCG Scraping`, `Worker TCG Prediction` et
  le `Microservice TCG` (orchestrateur).
- **Secrets Kubernetes** pour les clés/identifiants externes (OAuth eBay, `POKETRACE_API_KEY`,
  `TCGFAST_API_KEY`). TCGdex ne requiert aucune clé.
- **NetworkPolicies** : les workers communiquent uniquement via Redis TCG ; pas d'accès réseau
  latéral entre eux.
- **Redis TCG** déployé comme service interne (Redis Streams).
- **Ressources** : limites CPU/mémoire par worker ; le `Worker TCG Scraping` est léger (appels API
  uniquement) — budget mémoire standard.

Exemple (extrait de manifest) :

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: worker-tcg-api
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: worker-tcg-api
          image: collectionr/worker-tcg-api:latest
          envFrom:
            - secretRef:
                name: tcg-api-secrets   # POKETRACE_API_KEY, EBAY_OAUTH_TOKEN, TCGFAST_API_KEY
          resources:
            requests: { cpu: "100m", memory: "128Mi" }
            limits:   { cpu: "500m", memory: "256Mi" }
```

---

# 11. Conformité et garde-fous légaux (CGU vérifiées — juin 2026)

La **validation des CGU des APIs tierces** est un livrable de la refonte.

> **Règle d'or :** la licence **MIT de TCGdex couvre les métadonnées, PAS les prix** qu'il relaie.
> Les prix proviennent de **Cardmarket / TCGPlayer**, dont les **CGU s'appliquent en amont**. TCGFast
> et eBay Browse API ont leurs propres CGU — respectées par nature (usage officiel).

## Ce que CollectionR peut faire, par source

| Source | Métadonnées | Prix — afficher | Stocker | Usage commercial |
|--------|-------------|-----------------|---------|------------------|
| **TCGdex** | ✅ libre (MIT + attribution) | ⚠️ relayés (CGU source en amont) | ✅ métadonnées · ⚠️ prix = cache court | ✅ métadonnées · ⚠️ prix |
| **PokeTrace** | — | ✅ freemium (vérifier CGU commerciales) | ⚠️ à confirmer | ⚠️ vérifier avant GO |
| **eBay Browse** | — | annonces **actives** uniquement | ❌ market-research | restreint (programme dev) |
| **TCGFast Trader** | — | ✅ usage commercial autorisé (plan Trader) | ✅ selon CGU plan | ✅ plan Trader |
| **Cardmarket** (API) | — | ❌ sans **accord écrit** | ❌ | ❌ (réservé vendeurs pro) |
| **TCGPlayer** | — | ❌ ToS (store/combine/commercial interdits) | ❌ | ❌ |

> **Aucune** de ces sources n'autorise la **redistribution des prix bruts** (export, flux, API
> tierce). C'est exclu partout.

## Synthèse opérationnelle

- **Métadonnées** → **TCGdex (MIT)** : stockage, affichage et redistribution **OK** avec attribution
  + disclaimer Nintendo. Aucun souci.
- **Prix — phase étudiante (non-marchande)** : afficher des prix **indicatifs** via TCGdex avec
  mention claire de la source (« Cardmarket / TCGPlayer, à titre indicatif ») = **risque faible**.
  Cache court terme uniquement, **pas** de base de prix revendue.
- **Prix — passage commercial (point GO/NO-GO juridique)** : **TCGFast Trader** autorise l'usage
  commercial explicitement (plan Trader). **PokeTrace Pro** : vérifier les CGU commerciales.
  Activer TCGFast comme source commerciale principale dès le passage GO.
- **À bannir** : scraping de Cardmarket / eBay / TCGPlayer (CGU + Cloudflare Enterprise 2026),
  et toute **redistribution de prix bruts**.

## Garde-fous d'implémentation

- **Abstraction « fournisseur de prix »** (*adapter pattern*) : changer de source sans refonte.
- **Attribution** de la source (si exigée) + **disclaimer** de non-affiliation à Nintendo /
  The Pokémon Company.
- **Rate-limiting poli** (`aiolimiter`), User-Agent honnête, respect des limites d'API.
- **Journalisation** (`CollectLog`) pour la traçabilité.
- **RGPD** : ne collecter **aucune donnée personnelle de vendeur** (noms, localisation).
- **Droit *sui generis* des bases de données** (Directive 96/9/CE) : l'exception recherche/
  enseignement protège la phase étudiante, pas un usage commercial.
- **Revue juridique obligatoire avant tout passage commercial.**

---

# 12. Stratégie de tests

Alignée sur le **Document QA — Plan de Test (v1.4)** du projet.

- **Couverture cible : ≥ 50 %** du code du **service Python (Worker OCR + Worker TCG)** — seuil
  officiel fixé par le PAQ (§8.1) et le CDC (§7.1) pour les composants Python (QA §12). Le seuil de
  **70 %** concerne le **code métier critique du Backend NestJS**, **pas** le worker.
- **Outils** (QA §11) : **Pytest** (+ `pytest-cov`) pour les tests unitaires Python ; **Jest +
  Supertest** pour les tests d'intégration côté Backend. Les appels réseau sont **mockés**
  (`respx` / VCR) — aucune dépendance aux APIs tierces en CI.
- **Règle PR** (QA §13) : tout nouveau code inclut ses tests dans la **même Pull Request** ; la CI
  (GitHub Actions) **bloque le merge** si la couverture passe sous le seuil.

Le **code métier critique du Worker TCG** à couvrir en priorité (QA §4.1) :

| Domaine | Exemples de tests (unitaires, Pytest) |
|---------|----------------------------------------|
| Adaptateurs de source | Parsing des réponses TCGdex / PokeTrace / eBay Browse / TCGFast (champs prix, `updated`) |
| Normalisation | Mapping des états, conversion devise→EUR, normalisation des noms, langue |
| Identité du prix | Unicité `(cardId, source, condition, language)`, gestion des collisions |
| Agrégation | Calcul du prix moyen (`average_price`) exposé par l'API |
| Résilience | Retry/back-off sur HTTP 429, fallback cascade, idempotence des UPSERT, cache hit |

> **Tests d'intégration (QA §5)** : le flux `Microservice TCG → Redis TCG → Workers` et l'écriture
> `Worker → PostgreSQL` sont couverts par des tests d'intégration (Jest + Supertest / base de test),
> au même titre que les endpoints API du Backend.

---

# 13. Flux complet du système

## Flux 1 — Collecte périodique (automatique)

```
CRON (Backend NestJS)
        │  requête REST HTTP → Microservice TCG (FastAPI, POST /sync)
        ▼
Microservice TCG ──▶ publie les tâches par rôle sur Redis TCG (Streams)
        │
        ├─▶ Worker TCG API ──▶ TCGdex (niv. 1) ──▶ métadonnées + prix
        │       │ si indisponible ──▶
        ├─▶ Worker TCG Scraping ──▶ PokeTrace (niv. 2) / eBay Browse (niv. 3) / TCGFast (niv. 4)
        └─▶ Worker TCG Prediction ──▶ estimation IA
        ▼
Normalisation (EUR, état, langue) ──▶ PostgreSQL (card_prices, price_history)

Si toutes sources indisponibles ──▶ cache PostgreSQL + horodatage (pas d'erreur bloquante)
```

## Flux 2 — Consultation utilisateur

```
Client ──▶ GET /market/swsh3-20 ──▶ Backend NestJS ──▶ lecture PostgreSQL ──▶ réponse
```

> La collecte n'est **jamais** déclenchée à la demande. Les données affichées proviennent de la
> dernière exécution planifiée, ou du cache PostgreSQL si les sources sont indisponibles.

---

# 14. Worker TCG Prediction (rappel)

La **prédiction de prix** est assurée par un service/worker **Python d'IA** exposant `/predict-price`
(voir [clean-architecture.md](../../backend/clean-architecture.md)). Il s'appuie sur l'historique
(`price_history`) pour estimer une valeur. Il doit figurer explicitement dans l'architecture runtime
au même titre que les deux autres workers TCG.

---

# Conclusion

Le Microservice TCG, refondu, repose sur une architecture **conforme au runtime K3s** :

- **Cascade API 4 niveaux** : TCGdex (principal, FR + EN) → PokeTrace (fallback EUR) → eBay Browse API (USD) → TCGFast (fallback payant) ;
- **cache PostgreSQL permanent** comme filet de sécurité — aucune erreur bloquante pour l'utilisateur ;
- orchestration des **trois workers** (API, Scraping, Prediction) via **Redis TCG (Redis Streams)**,
  déclenchée par le backend via l'endpoint **FastAPI** de l'orchestrateur ;
- modèle de données intégrant la **langue**, source de vérité **PostgreSQL** ;
- **garde-fous légaux** explicites et **stratégie de tests alignée Doc QA** (≥ 50 % service Python).

Cette refonte respecte les conditions d'utilisation des APIs tierces tout en garantissant une
collecte fiable, maintenable et alignée avec l'architecture définie.

---

# Sources

Vérifications web (juin 2026) + **Document QA — Plan de Test v1.4** (document projet interne) :

- **TCGdex** : [FAQ](https://tcgdex.dev/faq) · [Markets & Prices](https://tcgdex.dev/markets-prices) · [base sous licence MIT](https://github.com/tcgdex/cards-database)
- **PokeTrace** : [https://poketrace.com](https://poketrace.com)
- **TCGFast** : [https://tcgfast.com](https://tcgfast.com)
- **eBay** : [dépréciation Finding API (newsletter Q3 2024)](https://developer.ebay.com/updates/newsletter/q3_2024) · [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) · [User Agreement 2026 (interdit les bots)](https://www.valueaddedresource.net/ebay-bans-ai-agents-updates-arbitration-user-agreement-feb-2026/)
- **Cardmarket** : [API (réservée vendeurs pro)](https://help.cardmarket.com/en/cardmarket-api) · [CGU](https://www.cardmarket.com/en/Policies/GeneralTermsAndConditions)
- **TCGPlayer** : [API fermée aux nouveaux dev](https://docs.tcgplayer.com/docs/getting-started) · [API Terms & Conditions](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions)
- **Stratégie de tests** : Document QA — Plan de Test v1.4 (§4, §5, §11, §12, §13).
