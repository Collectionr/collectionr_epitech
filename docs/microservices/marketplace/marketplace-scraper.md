# Microservice TCG — collecte des cartes et des prix

## Vue d'ensemble

Ce document décrit la conception du **Microservice TCG** du projet CollectionR et de ses **workers**,
conformément à l'architecture runtime ([03-flux-techniques-plateforme.md](../../architecture/03-flux-techniques-plateforme.md)).

Son rôle est de **synchroniser les métadonnées de cartes** et de **collecter les prix de marché**
des cartes Pokémon TCG, puis de les stocker dans PostgreSQL.

> **Important** : le Microservice TCG et ses workers sont des **composants d'arrière-plan**. Ils
> n'exposent **aucune API REST** aux clients. Seul le backend **NestJS (sur adaptateur Fastify)**
> expose des endpoints. Les workers sont écrits en **Python** (cohérent avec le Pipeline de Données
> Python décrit dans [clean-architecture.md](../../backend/clean-architecture.md)).

---

# 1. Périmètre et workers

Le Microservice TCG **orchestre trois workers** via une file Redis dédiée (`Redis TCG`) :

| Worker | Rôle | Sources |
|--------|------|---------|
| **Worker TCG API** | Synchronise les **métadonnées** et les **prix agrégés** | TCGdex, pokemontcg.io ; eBay Browse (optionnel) |
| **Worker TCG Scraping** | Collecte des prix **en dernier recours** (fallback) quand une donnée manque | Scraping HTML encadré (eBay marginal) |
| **Worker TCG Prediction** | Prédit/estime des prix (IA) à partir de l'historique | Service Python `/predict-price` (cf. clean-architecture) |

> **Note de nommage.** Le worker historiquement appelé « Worker TCG Scraping » dans l'architecture
> runtime collecte des prix de façon **API-first** ; le scraping HTML n'est qu'un **fallback**. Le
> nom est conservé pour rester aligné avec l'architecture runtime, mais sa **méthode principale est
> l'appel d'API**.

---

# 2. Architecture globale

## Position dans le système

```
                         CLIENTS (web / mobile)
                                  │  HTTP (REST + SSE)
                                  ▼
                  BACKEND NESTJS (adaptateur Fastify)
                 API · auth · LECTURE des prix en base
                                  │  planifie (Redis TCG / BullMQ)
                                  ▼
                   MICROSERVICE TCG (orchestrateur)
                                  │  distribue les tâches via Redis TCG
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                          ▼
 ┌──────────────┐        ┌──────────────────┐      ┌──────────────────┐
 │ Worker TCG   │        │ Worker TCG       │      │ Worker TCG       │
 │ API (Python) │        │ Scraping (Python)│      │ Prediction (Py)  │
 └──────┬───────┘        └────────┬─────────┘      └────────┬─────────┘
        │ API ouverte             │ scraping (recours)      │ modèle IA
        ▼                         ▼                         │ (sur historique)
 ┌──────────────┐        ┌──────────────────┐               │
 │ TCGdex /     │        │ eBay Browse /    │               │
 │ pokemontcg.io│        │ HTML (marginal)  │               │
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

> **Tous les workers (API, Scraping, Prediction) écrivent dans PostgreSQL** via `psycopg 3`
> (UPSERT idempotents). PostgreSQL est l'**unique source de vérité** ; le backend NestJS y **lit les prix**,
> et les **écritures** sur les tables de prix sont réservées aux workers.

## Responsabilités

| Responsabilité | Worker | Description |
|----------------|--------|-------------|
| Synchronisation cartes | TCG API | Métadonnées + images (URLs uniquement) |
| Collecte des prix | TCG API | Prix agrégés Cardmarket/TCGPlayer via API ouverte |
| Fallback prix | TCG Scraping | Scraping HTML encadré, si donnée manquante |
| Estimation de prix | TCG Prediction | Modèle IA sur l'historique |
| Normalisation | tous | Devise → EUR, état, **langue**, noms |
| Stockage | tous | Écriture idempotente en PostgreSQL |

> **Spécificités (alignées sur l'architecture runtime) :** aucune image n'est stockée localement
> (seules les URLs sont utilisées) ; les workers sont des **Pods K3s indépendants** ; un mécanisme
> de **retry avec back-off exponentiel** est prévu ; le respect des CGU des APIs tierces est
> obligatoire.

---

# 3. Sources de données (réalité 2026)

L'audit de juin 2026 a établi l'état réel d'accès aux sources. La stratégie en découle.

| Source | Type | Accès | Usage CollectionR |
|--------|------|-------|-------------------|
| **TCGdex** | API ouverte | Gratuit, sans clé | **Principal** : métadonnées + prix (CM €, TCGP $) |
| **pokemontcg.io** | API ouverte | Gratuit (clé gratuite : 20 000 req/j) | **Principal** : prix CM + TCGP en un appel |
| **TCGCSV** | Export bulk | Gratuit, sans clé | Fallback bulk TCGPlayer (pas de Cardmarket, ni par état) |
| **eBay** | API Browse | OAuth, ~5 000 appels/j/app | Optionnel : **annonces actives** uniquement |
| **Cardmarket** | API | Vendeurs pro, approbation manuelle | **Écarté** : CGU interdisent l'usage tiers |
| **TCGPlayer** | API | **Fermée aux nouveaux dev** (fin 2024) | **Écarté** : inaccessible + ToS |

> **Conséquence clé :** les prix Cardmarket et TCGPlayer sont **déjà fournis légalement** par TCGdex
> et pokemontcg.io. Scraper directement ces sites serait **non conforme aux CGU et inutile**.

---

# 4. Stratégie de collecte (API-first multi-méthode)

Par ordre de priorité (cf. [decision-technique.md](decision-technique.md)) :

1. **API ouverte (source principale)** — `Worker TCG API` interroge TCGdex / pokemontcg.io pour les
   métadonnées et les prix agrégés.
2. **eBay Browse API (complément optionnel)** — annonces actives, via OAuth.
3. **Scraping HTML (dernier recours)** — `Worker TCG Scraping`, **isolé derrière un kill-switch**,
   à faible volume, **jamais sur Cardmarket ni TCGPlayer**.
4. **Flux RSS** — uniquement pour une rubrique « actualités / sorties de sets » (les flux RSS de
   prix n'existent plus en 2026), **jamais pour les prix**.

### Fallback scraping : outils

Conformément à l'architecture runtime, le fallback s'appuie sur la stack Python :

- **Pages HTML statiques** : `httpx` + `BeautifulSoup` (ou `selectolax`).
- **Pages rendues en JavaScript** : `Playwright` (dernier recours).
- **Cible protégée par fingerprint TLS** : `curl_cffi` ; `nodriver` + proxies résidentiels si défi JS.

> En 2026, les protections anti-bot (Cloudflare/Akamai) rendent le scraping des marketplaces
> coûteux et fragile. Le fallback est donc une **capacité documentée**, activée à la marge.

---

# 5. Planification des tâches (Cron / BullMQ)

La planification est portée par le backend NestJS via **BullMQ (Redis TCG)** ; les workers Python
**consomment** la file.

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

> L'exécution à 3 h du matin minimise l'impact sur les sources externes et lisse la charge. Une
> seule fréquence quotidienne suffit au besoin (les cotes Cardmarket/TCGPlayer fournies par les APIs
> ouvertes sont elles-mêmes mises à jour quotidiennement).

---

# 6. Modèle de données

> Le **schéma est la propriété du backend NestJS (Prisma)** ; le worker Python écrit via `psycopg 3`
> avec des **UPSERT idempotents**. Les deux représentations doivent rester strictement alignées.

### Table `CardPrice` — prix actuel

```prisma
model CardPrice {
  id         String   @id @default(uuid())
  cardId     String
  source     String   // "tcgdex", "pokemontcg", "ebay"
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

### Table `ScrapeLog` — suivi des collectes

```prisma
model ScrapeLog {
  id         String    @id @default(uuid())
  cardId     String?
  source     String
  method     String    // "api" | "scraping"
  status     String    // "success" | "error" | "skipped"
  errorMsg   String?
  startedAt  DateTime  @default(now())
  finishedAt DateTime?

  @@map("scrape_logs")
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
donne lieu à une entrée `ScrapeLog`. En cas d'échec, le backend continue de servir la **dernière
donnée disponible** : aucun blocage de service. K3s **redémarre automatiquement** un Pod défaillant.

---

# 9. Intégration avec le backend NestJS

- Le backend **NestJS (Fastify)** planifie les jobs via **BullMQ (Redis TCG)** et **lit** les prix
  en base.
- Les **workers Python consomment** la file Redis (lib `bullmq` Python) et **écrivent** en
  PostgreSQL via `psycopg 3`.
- Le scraping n'est **jamais** déclenché par une requête utilisateur.

```
Client ──▶ GET /market/swsh3-20 ──▶ Backend NestJS ──▶ lecture PostgreSQL
                                                   │
                            données présentes ─────┴──▶ réponse
                            sinon ──▶ réponse vide (le prochain job remplira)
```

| Composant | Rôle |
|-----------|------|
| Microservice TCG | Orchestre les workers, planifie via Redis TCG |
| Worker TCG API / Scraping / Prediction | Collectent / estiment, écrivent en base |
| Backend NestJS (Fastify) | Expose les endpoints, lit les données |
| PostgreSQL | Source de vérité des prix |
| Redis TCG | File BullMQ (planification), pas de stockage de prix |

> **Réserve technique :** la lib `bullmq` Python est en statut *Alpha* (parité incomplète avec Node).
> Valider tôt un **POC d'interopérabilité** Node→Python sur une file de test ; prévoir un repli
> `APScheduler` si l'interop pose problème.

---

# 10. Alignement K3s (architecture runtime)

Conformément à [03-flux-techniques-plateforme.md](../../architecture/03-flux-techniques-plateforme.md),
chaque composant est un **Pod K3s** :

- **Deployments** distincts pour `Worker TCG API`, `Worker TCG Scraping`, `Worker TCG Prediction` et
  le `Microservice TCG` (orchestrateur).
- **Secrets Kubernetes** pour les clés/identifiants externes (clé pokemontcg.io, OAuth eBay). TCGdex
  ne requiert aucune clé.
- **NetworkPolicies** : les workers communiquent uniquement via Redis TCG ; pas d'accès réseau
  latéral entre eux.
- **Redis TCG** déployé comme service interne (file BullMQ).
- **Ressources** : limites CPU/mémoire par worker ; le `Worker TCG Scraping` (Playwright) est plus
  gourmand → budget mémoire dédié et **réplicas** seulement si nécessaire.

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
                name: tcg-api-secrets   # POKEMONTCG_API_KEY, EBAY_OAUTH...
          resources:
            requests: { cpu: "100m", memory: "128Mi" }
            limits:   { cpu: "500m", memory: "256Mi" }
```

---

# 11. Conformité et garde-fous légaux (CGU vérifiées — juin 2026)

La **validation des CGU des APIs tierces** est un livrable de la refonte.

> **Règle d'or :** la licence **MIT de TCGdex couvre les métadonnées, PAS les prix** qu'il relaie.
> Les prix proviennent de **Cardmarket / TCGPlayer**, dont les **CGU s'appliquent en amont** — y
> compris quand on passe par un agrégateur (TCGdex, pokemontcg.io).

## Ce que CollectionR peut faire, par source

| Source | Métadonnées | Prix — afficher | Stocker | Usage commercial |
|--------|-------------|-----------------|---------|------------------|
| **TCGdex** | ✅ libre (MIT + attribution) | ⚠️ relayés (CGU source en amont) | ✅ métadonnées · ⚠️ prix = cache court | ✅ métadonnées · ⚠️ prix |
| **pokemontcg.io** | ✅ | ⚠️ relayés ; free tier **non-commercial** | cache | ❌ free tier → payant requis |
| **Cardmarket** (API) | — | ❌ sans **accord écrit** | ❌ | ❌ (réservé vendeurs pro) |
| **Cardmarket Price Guide** (dataset gratuit, quotidien) | — | ⚠️ 1re main mais « présentation » soumise à accord écrit | ✅ téléchargeable | ⚠️ accord requis |
| **eBay Browse** | — | annonces **actives** uniquement | ❌ market-research | restreint |
| **TCGPlayer** | — | ❌ ToS (store/combine/commercial interdits) | ❌ | ❌ |
| **PokemonPriceTracker** | — | ✅ **affichage autorisé** (ToS) | ok | ✅ dès le plan API (9,99 $) |
| **JustTCG / PokeTrace / pokemon-api.com** | — | ✅ sur plan payant | ⚠️ à confirmer par écrit | ✅ plan payant |
| **TCGCSV / PriceCharting** | — | ❌ (miroir TCGPlayer / affichage tiers interdit) | — | ❌ |

> **Aucune** de ces sources n'autorise la **redistribution des prix bruts** (export, flux, API
> tierce). C'est exclu partout.

## Synthèse opérationnelle

- **Métadonnées** → **TCGdex (MIT)** : stockage, affichage et redistribution **OK** avec attribution
  + disclaimer Nintendo. Aucun souci.
- **Prix — phase étudiante (non-marchande)** : afficher des prix **indicatifs** via TCGdex /
  pokemontcg.io avec mention claire de la source (« Cardmarket / TCGPlayer, à titre indicatif ») =
  **risque faible**. Cache court terme uniquement, **pas** de base de prix revendue.
- **Prix — passage commercial (point GO/NO-GO juridique)** : basculer sur une source à **licence
  commerciale explicite autorisant l'affichage** — **PokemonPriceTracker** (affichage autorisé,
  commercial dès le plan API) ou JustTCG / PokeTrace / pokemon-api.com (plans payants). Pour la cote
  **Cardmarket EUR** de première main, le **Price Guide Cardmarket** (dataset gratuit quotidien) est
  une piste, mais sa **présentation** à des tiers requiert un **accord écrit** Cardmarket.
- **À bannir** : scraping de Cardmarket / eBay / TCGPlayer (CGU + anti-bot), **TCGCSV** et
  **PriceCharting** pour une app grand public, et toute **redistribution de prix bruts**.

## Garde-fous d'implémentation

- **Abstraction « fournisseur de prix »** (*adapter pattern*) : changer de source sans refonte.
- **Kill-switch par source** ; scraping désactivable.
- **Attribution** de la source (si exigée) + **disclaimer** de non-affiliation à Nintendo /
  The Pokémon Company.
- **Rate-limiting poli**, User-Agent honnête, respect de `robots.txt`.
- **Journalisation** (`ScrapeLog`) pour la traçabilité.
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

Le **code métier critique du Worker TCG** à couvrir en priorité (QA §4.1 — appels API externes et
normalisation des données) :

| Domaine | Exemples de tests (unitaires, Pytest) |
|---------|----------------------------------------|
| Adaptateurs de source | Parsing des réponses TCGdex / pokemontcg.io (champs prix, `updated`) |
| Normalisation | Mapping des états, conversion devise→EUR, normalisation des noms, langue |
| Identité du prix | Unicité `(cardId, source, condition, language)`, gestion des collisions |
| Agrégation | Calcul du prix moyen (`average_price`) exposé par l'API |
| Résilience | Retry/back-off sur HTTP 429, *kill-switch* scraping, idempotence des UPSERT |

> **Tests d'intégration (QA §5)** : le flux `Microservice TCG → Redis TCG → Workers` et l'écriture
> `Worker → PostgreSQL` sont couverts par des tests d'intégration (Jest + Supertest / base de test),
> au même titre que les endpoints API du Backend.

---

# 13. Flux complet du système

## Flux 1 — Collecte périodique (automatique)

```
CRON / BullMQ (Redis TCG)
        │  job planifié
        ▼
Microservice TCG ──▶ distribue aux workers
        │
        ├─▶ Worker TCG API ───▶ TCGdex / pokemontcg.io ──▶ métadonnées + prix
        ├─▶ Worker TCG Scraping ─▶ (fallback HTML encadré, si manque)
        └─▶ Worker TCG Prediction ─▶ estimation IA
        ▼
Normalisation (EUR, état, langue) ──▶ PostgreSQL (card_prices, price_history)
```

## Flux 2 — Consultation utilisateur

```
Client ──▶ GET /market/swsh3-20 ──▶ Backend NestJS ──▶ lecture PostgreSQL ──▶ réponse
```

> Le scraping n'est **jamais** déclenché à la demande. Les données affichées proviennent de la
> dernière exécution planifiée.

---

# 14. Worker TCG Prediction (rappel)

La **prédiction de prix** est assurée par un service/worker **Python d'IA** exposant `/predict-price`
(voir [clean-architecture.md](../../backend/clean-architecture.md)). Il s'appuie sur l'historique
(`price_history`) pour estimer une valeur. Il doit figurer explicitement dans l'architecture runtime
au même titre que les deux autres workers TCG.

---

# Conclusion

Le Microservice TCG, refondu, repose sur une architecture **conforme au runtime K3s** :

- **API-first** via TCGdex / pokemontcg.io (prix agrégés Cardmarket + TCGPlayer, légalement) ;
- **scraping HTML en dernier recours encadré** (Python : BeautifulSoup / Playwright / curl_cffi) ;
- orchestration des **trois workers** (API, Scraping, Prediction) via **Redis TCG (BullMQ)** ;
- modèle de données intégrant la **langue**, source de vérité **PostgreSQL** (tous les workers y écrivent) ;
- **garde-fous légaux** explicites et **stratégie de tests alignée Doc QA** (≥ 50 % service Python).

Cette refonte respecte les conditions d'utilisation des APIs tierces tout en garantissant une
collecte fiable, maintenable et alignée avec l'architecture définie.

---

# Sources

Vérifications web (juin 2026) + **Document QA — Plan de Test v1.4** (document projet interne) :

- **TCGdex** : [FAQ](https://tcgdex.dev/faq) · [Markets & Prices](https://tcgdex.dev/markets-prices) · [base sous licence MIT](https://github.com/tcgdex/cards-database)
- **pokemontcg.io** : [rate limits](https://docs.pokemontcg.io/getting-started/rate-limits/) · [authentification](https://docs.pokemontcg.io/getting-started/authentication/)
- **eBay** : [dépréciation Finding API (newsletter Q3 2024)](https://developer.ebay.com/updates/newsletter/q3_2024) · [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) · [robots.txt](https://www.ebay.com/robots.txt) · [User Agreement 2026 (interdit les bots)](https://www.valueaddedresource.net/ebay-bans-ai-agents-updates-arbitration-user-agreement-feb-2026/)
- **Cardmarket** : [API (réservée vendeurs pro)](https://help.cardmarket.com/en/cardmarket-api) · [CGU](https://www.cardmarket.com/en/Policies/GeneralTermsAndConditions) · [Price Guide (dataset gratuit, quotidien)](https://www.cardmarket.com/en/Magic/Data/Price-Guide)
- **TCGPlayer** : [API fermée aux nouveaux dev](https://docs.tcgplayer.com/docs/getting-started) · [API Terms & Conditions](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions)
- **Agrégateurs** : [JustTCG — Terms](https://justtcg.com/terms) · [PokeTrace — pricing](https://poketrace.com/pricing) · [pokemon-api.com](https://www.pokemon-api.com/) · [PokemonPriceTracker — Terms](https://www.pokemonpricetracker.com/terms) · [TCGCSV](https://tcgcsv.com/) · [PriceCharting — API](https://www.pricecharting.com/api-documentation)
- **Anti-bot 2026** : [benchmark anti-détection (Paterson)](https://ianlpaterson.com/blog/anti-detect-browser-benchmark-patchright-nodriver-curl-cffi/)
- **Stratégie de tests** : Document QA — Plan de Test v1.4 (§4, §5, §11, §12, §13).
