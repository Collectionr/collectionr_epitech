# Microservice TCG — collecte des cartes et des prix

## Vue d'ensemble

Ce document décrit la conception du **Microservice TCG** du projet CollectionR et de ses **workers**,
conformément à l'architecture runtime ([03-flux-techniques-plateforme.md](../architecture/03-flux-techniques-plateforme.md)).

Son rôle est de **synchroniser les métadonnées de cartes** et de **collecter les prix de marché**
des cartes Pokémon TCG, puis de les stocker dans PostgreSQL.

> **Important** : le Microservice TCG et ses workers sont des **composants d'arrière-plan**. Ils
> n'exposent **aucune API REST** aux clients. Seul le backend **NestJS (sur adaptateur Fastify)**
> expose des endpoints. Les workers sont écrits en **Python** (cohérent avec le Pipeline de Données
> Python décrit dans [clean-architecture.md](../backend/clean-architecture.md)).

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
┌──────────────────────────────────────────────────────────┐
│                         CLIENTS (web / mobile)             │
└─────────────────────────────┬────────────────────────────┘
                              │ HTTP (REST + SSE)
┌─────────────────────────────▼────────────────────────────┐
│              BACKEND NESTJS (adaptateur Fastify)           │
│        API principale, authentification, lecture prix      │
└──────────────┬─────────────────────────┬──────────────────┘
               │ planifie (BullMQ)        │ lecture
               ▼                          ▼
┌──────────────────────────┐   ┌──────────────────────────────┐
│   MICROSERVICE TCG        │   │        PostgreSQL            │
│   (orchestrateur)         │   │  cartes, prix, historique,   │
│                           │   │  logs de collecte            │
└──────────────┬───────────┘   └───────────────▲──────────────┘
               │ Redis TCG (BullMQ)             │ écriture (psycopg 3)
        ┌──────┴───────────┬───────────────┐    │
        ▼                  ▼               ▼    │
┌───────────────┐ ┌────────────────┐ ┌──────────────────┐
│ Worker TCG API│ │ Worker TCG     │ │ Worker TCG       │
│  (Python)     │ │ Scraping (Py)  │ │ Prediction (Py)  │
└──────┬────────┘ └──────┬─────────┘ └────────┬─────────┘
       │ API ouverte     │ scraping (recours)  │ modèle IA
       ▼                 ▼                     ▼
┌──────────────────────────────────────────────────────────┐
│        SOURCES EXTERNES                                    │
│  TCGdex · pokemontcg.io  |  eBay Browse  |  (HTML marginal)│
└──────────────────────────────────────────────────────────┘
```

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

### Fréquences retenues

```
Cartes populaires (top 100)   →  toutes les heures
Cartes standards              →  toutes les 6 heures
Cartes peu demandées          →  une fois par jour (3h du matin)
```

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

Conformément à [03-flux-techniques-plateforme.md](../architecture/03-flux-techniques-plateforme.md),
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

# 11. Conformité et garde-fous légaux

La **validation des CGU des APIs tierces** est un livrable de la refonte.

- **APIs ouvertes** (TCGdex, pokemontcg.io) : free tier **non-commercial** → adapté à la phase
  étudiante ; **palier payant à licence commerciale** requis avant toute commercialisation.
- **Cardmarket** : CGU interdisent de présenter prix/cartes sur un service tiers sans **accord
  écrit** — réafficher ces prix (même via un agrégateur) en commercial est risqué.
- **TCGPlayer** : ToS interdit le crawl/scrape ; API fermée → **écarté**.
- **eBay** : robots.txt `Disallow`, user agreement 2026 interdisant les bots → pas de scraping ; API
  Browse uniquement (annonces actives).
- **RGPD** : ne collecter **aucune donnée personnelle de vendeur** (noms, localisation).
- **Droit *sui generis* des bases de données** (Directive 96/9/CE) : l'exception recherche/
  enseignement protège la phase étudiante non-marchande, pas un usage commercial.

### Garde-fous d'implémentation

- **Abstraction « fournisseur de prix »** (*adapter pattern*) : changer de source sans refonte.
- **Kill-switch par source** ; scraping désactivable.
- **Attribution** de la source + **disclaimer** de non-affiliation à Nintendo / The Pokémon Company.
- **Rate-limiting poli**, User-Agent honnête, respect de `robots.txt`.
- **Journalisation** (`ScrapeLog`) pour la traçabilité.
- **Revue juridique obligatoire avant tout passage commercial.**

---

# 12. Stratégie de tests (objectif ≥ 70 % du code métier critique)

Outils : **`pytest`**, **`pytest-cov`** (couverture), **`respx`** (mock des appels `httpx`),
**`pytest-recording`/VCR** (rejouer des réponses d'API).

Le **code métier critique** à couvrir en priorité :

| Domaine | Exemples de tests |
|---------|-------------------|
| Adaptateurs de source | Parsing des réponses TCGdex / pokemontcg.io (champs prix, `updated`) |
| Normalisation | Mapping des états, conversion devise→EUR, normalisation des noms |
| Identité du prix | Unicité `(cardId, source, condition, language)`, gestion des collisions |
| Agrégation | Calcul du prix moyen (`average_price`) exposé par l'API |
| Résilience | Retry/back-off sur HTTP 429, *kill-switch* scraping, idempotence des UPSERT |
| Garde-fous | Respect des quotas, attribution, non-collecte de données personnelles |

> Cible : **≥ 70 % de couverture** sur ces modules métier (mesurée via `pytest-cov`). Les appels
> réseau réels sont **mockés** (pas de dépendance aux APIs tierces dans la CI).

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
(voir [clean-architecture.md](../backend/clean-architecture.md)). Il s'appuie sur l'historique
(`price_history`) pour estimer une valeur. Il doit figurer explicitement dans l'architecture runtime
au même titre que les deux autres workers TCG.

---

# Conclusion

Le Microservice TCG, refondu, repose sur une architecture **conforme au runtime K3s** :

- **API-first** via TCGdex / pokemontcg.io (prix agrégés Cardmarket + TCGPlayer, légalement) ;
- **scraping HTML en dernier recours encadré** (Python : BeautifulSoup / Playwright / curl_cffi) ;
- orchestration des **trois workers** (API, Scraping, Prediction) via **Redis TCG (BullMQ)** ;
- modèle de données intégrant la **langue**, source de vérité **PostgreSQL** ;
- **garde-fous légaux** explicites et **stratégie de tests ≥ 70 %**.

Cette refonte respecte les conditions d'utilisation des APIs tierces tout en garantissant une
collecte fiable, maintenable et alignée avec l'architecture définie.
