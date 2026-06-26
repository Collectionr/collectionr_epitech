# Architecture — `collectionr-workers`

## Table des matières

1. [Rôle du dépôt dans la plateforme](#1-rôle-du-dépôt-dans-la-plateforme)
2. [Structure des dossiers](#2-structure-des-dossiers)
3. [Les cinq workers](#3-les-cinq-workers)
   - [3.1 Worker OCR](#31-worker-ocr)
   - [3.2 Worker Grading IA](#32-worker-grading-ia)
   - [3.3 Worker TCG API](#33-worker-tcg-api)
   - [3.4 Worker TCG Scraping](#34-worker-tcg-scraping)
   - [3.5 Worker TCG Prediction](#35-worker-tcg-prediction)
4. [Consommation des queues Redis](#4-consommation-des-queues-redis)
5. [Lien avec l'Architecture Runtime A4 — Pods K3s](#5-lien-avec-larchitecture-runtime-a4--pods-k3s)
6. [Note sur le modèle d'inférence OCR](#6-note-sur-le-modèle-dinférence-ocr-placeholder)

---

## 1. Rôle du dépôt dans la plateforme

La plateforme Collectionr repose sur **deux dépôts backend distincts** :

| Dépôt | Langage | Rôle |
|---|---|---|
| `collectionr-api` | TypeScript / Fastify | API principale : authentification, logique métier, exposition HTTP |
| `collectionr-workers` | Python | Traitements lourds asynchrones : IA, scraping, prédiction de prix |

Les workers ne sont **jamais appelés directement par le client**. Ils consomment des **files de tâches Redis** alimentées par le backend, exécutent le traitement, puis écrivent les résultats dans **PostgreSQL**. Le backend lit ces résultats et les renvoie au client.

```
Client
  │
  ▼
Backend TypeScript  ──── pousse un job ────▶  Redis (queue)
                                                    │
                                                    ▼
                                            Worker Python
                                                    │
                                          exécute le traitement
                                                    │
                                                    ▼
                                              PostgreSQL
                                                    │
                         lit le résultat            │
Backend TypeScript  ◀────────────────────────────────
  │
  ▼
Client
```

Ce modèle **découple les traitements lents** (OCR, modèles ML, scraping) du cycle requête/réponse HTTP. Le backend ne se bloque jamais en attendant un résultat — il délègue et continue.

---

## 2. Structure des dossiers

```
collectionr-workers/
│
├── workers/
│   │
│   ├── ocr/                        # Worker IA — extraction de texte depuis une image de carte
│   │   ├── consumer.py             # Écoute la queue Redis "ocr", reçoit les jobs
│   │   ├── inference.py            # Appel au modèle d'inférence (voir section 6)
│   │   └── postprocessing.py       # Transforme le résultat brut en JSON structuré
│   │
│   ├── grading/                    # Worker IA — évaluation de l'état physique de la carte
│   │   ├── consumer.py             # Écoute la queue Redis "grading"
│   │   └── grader.py               # Logique de notation (Mint, NM, LP, MP, HP, DMG)
│   │
│   ├── tcg_api/                    # Worker TCG — synchronisation des métadonnées de cartes
│   │   ├── consumer.py             # Écoute la queue Redis "tcg"
│   │   ├── tcgdex.py               # Appels vers l'API TCGDex (~22 000 cartes)
│   │   └── normalizer.py           # Normalisation des données avant écriture PostgreSQL
│   │
│   ├── tcg_scraping/               # Worker TCG — collecte automatique des prix marketplace
│   │   ├── scheduler.py            # Cron jobs (APScheduler) — pas de queue Redis
│   │   ├── cardmarket.py           # Collecte Cardmarket (API OAuth)
│   │   ├── ebay.py                 # Collecte eBay (Finding API)
│   │   ├── tcgplayer.py            # Collecte TCGPlayer (API REST)
│   │   └── normalizer.py           # Normalisation devises, états de carte, noms
│   │
│   └── tcg_prediction/             # Worker TCG — prédiction de prix par modèle ML
│       ├── consumer.py             # Écoute la queue Redis "tcg"
│       └── model.py                # Chargement et inférence du modèle de prédiction
│
├── shared/
│   ├── db.py                       # Client PostgreSQL partagé (SQLAlchemy / psycopg2)
│   ├── redis_client.py             # Client Redis partagé (redis-py + RQ/BullMQ)
│   └── config.py                   # Variables d'environnement (DATABASE_URL, REDIS_URL…)
│
├── docker/
│   ├── Dockerfile.ocr              # Image du worker OCR (avec dépendances GPU si nécessaire)
│   ├── Dockerfile.grading          # Image du worker Grading
│   └── Dockerfile.tcg              # Image commune workers TCG (API, Scraping, Prediction)
│
├── k8s/                            # Manifestes K3s — un Deployment par worker
│   ├── ocr-deployment.yaml
│   ├── grading-deployment.yaml
│   └── tcg-deployment.yaml
│
└── requirements.txt                # Dépendances Python
```

---

## 3. Les cinq workers

### 3.1 Worker OCR

**Famille** : IA
**Queue Redis** : `ocr`

**Rôle** : recevoir l'image d'une carte Pokémon, en extraire les informations structurées (nom, HP, type, attaques, numéro, édition, rareté) et écrire le résultat dans PostgreSQL.

**Déclencheur** : le backend pousse un job dans la queue dès qu'un utilisateur scanne une carte via `POST /scan`.

**Flux interne** :

```
consumer.py
    │  reçoit l'URL de l'image depuis la queue
    ▼
inference.py
    │  passe l'image au modèle OCR (voir section 6)
    ▼
postprocessing.py
    │  structure le résultat brut en JSON métier
    ▼
PostgreSQL  (table scan_results)
```

| Étape | Ce qui se passe |
|---|---|
| 1. Réception | Le consumer lit un message contenant l'identifiant de l'image |
| 2. Inférence | Le modèle OCR extrait le texte et les zones de la carte |
| 3. Post-processing | Les champs bruts sont structurés en JSON (nom, HP, attaques…) |
| 4. Écriture | Le résultat est écrit dans la table `scan_results` de PostgreSQL |

> Le modèle utilisé à l'étape 2 est un **placeholder** — voir [section 6](#6-note-sur-le-modèle-dinférence-ocr-placeholder).

---

### 3.2 Worker Grading IA

**Famille** : IA
**Queue Redis** : `grading`

**Rôle** : analyser l'état physique d'une carte (usure, rayures, bords, centering) et lui attribuer une note d'état standardisée.

**Déclencheur** : le backend pousse un job après réception de l'image, en parallèle ou en suite du worker OCR.

**Flux interne** :

```
consumer.py
    │  reçoit l'image et les métadonnées de la carte
    ▼
grader.py
    │  analyse les zones d'usure visibles
    ▼
PostgreSQL  (table card_grades)
```

**Grades retournés** :

| Grade | Signification |
|---|---|
| `MINT` | Parfait état, jamais joué |
| `NM` | Near Mint — légères marques d'usage |
| `LP` | Lightly Played — usure visible mais légère |
| `MP` | Moderately Played — usure modérée |
| `HP` | Heavily Played — fort usure |
| `DMG` | Damaged — carte endommagée |

---

### 3.3 Worker TCG API

**Famille** : TCG
**Queue Redis** : `tcg`

**Rôle** : synchroniser les métadonnées de cartes Pokémon depuis les APIs externes (TCGDex) vers la base de données interne.

**Déclencheur** : job planifié (cron) ou déclenché manuellement lors de l'ajout de nouveaux sets.

**Flux interne** :

```
consumer.py
    │  reçoit un identifiant de set ou de carte à synchroniser
    ▼
tcgdex.py
    │  appel GET https://api.tcgdex.net/v2/en/cards/{id}
    ▼
normalizer.py
    │  uniformise les champs (noms, langues, formats)
    ▼
PostgreSQL  (table cards)
```

**Source principale** : [API TCGDex](https://tcgdex.dev) — ~22 000 cartes Pokémon, plusieurs langues, sans clé API requise.

---

### 3.4 Worker TCG Scraping

**Famille** : TCG
**Déclencheur** : **cron interne** (APScheduler) — ce worker ne consomme pas de queue Redis

**Rôle** : collecter automatiquement les prix des cartes depuis les marketplaces externes et les stocker dans PostgreSQL.

**Stratégie de collecte** : API-first. Le scraping HTML n'est utilisé qu'en dernier recours si une API n'est pas disponible.

**Flux interne** :

```
scheduler.py  (APScheduler — cron)
    │
    ├── cardmarket.py  (API OAuth)
    ├── ebay.py        (Finding API)
    └── tcgplayer.py   (API REST)
            │
            ▼
        normalizer.py
            │  devise → EUR, état standardisé, nom normalisé
            ▼
        PostgreSQL  (tables card_prices, price_history, scrape_logs)
```

**Fréquences de collecte** :

| Priorité | Fréquence |
|---|---|
| Top 100 cartes populaires | Toutes les heures |
| Cartes standards | Toutes les 6 heures |
| Cartes peu demandées | Une fois par jour |

**Marketplaces ciblées** :

| Marketplace | Région | API utilisée |
|---|---|---|
| Cardmarket | Europe | API OAuth REST |
| eBay | Mondiale | Finding API |
| TCGPlayer | USA | API REST |

> Ce worker est le seul à ne **pas** consommer de queue Redis : il s'auto-déclenche via APScheduler selon le planning défini.

---

### 3.5 Worker TCG Prediction

**Famille** : TCG
**Queue Redis** : `tcg`

**Rôle** : estimer le prix futur d'une carte à partir de son historique de prix et de ses attributs (rareté, édition, état).

**Déclencheur** : job poussé par le backend lorsqu'un utilisateur demande une estimation de prix.

**Flux interne** :

```
consumer.py
    │  reçoit le card_id et les attributs de la carte
    ▼
model.py
    │  chargement du modèle ML + inférence → prix estimé en EUR
    ▼
PostgreSQL  (table price_predictions)
```

| Entrée | Sortie |
|---|---|
| `card_id`, rareté, édition, état, historique prix | Prix estimé en EUR + intervalle de confiance |

---

## 4. Consommation des queues Redis

Trois queues Redis orchestrent les traitements asynchrones. Le backend TypeScript **produit** les jobs, les workers Python les **consomment**.

```
┌──────────────────────────────────────────────────────────────┐
│                    BACKEND TYPESCRIPT                        │
│           (producteur — écrit les jobs dans Redis)          │
└──────────────┬────────────────┬─────────────────────────────┘
               │                │                   │
               ▼                ▼                   ▼
      ┌──────────────┐  ┌───────────────┐  ┌────────────────┐
      │  queue: ocr  │  │queue: grading │  │  queue: tcg    │
      │   (BullMQ)   │  │   (BullMQ)    │  │   (BullMQ)     │
      └──────┬───────┘  └───────┬───────┘  └───────┬────────┘
             │                  │                   │
             ▼                  ▼             ┌─────┴──────────┐
    ┌─────────────────┐  ┌──────────────┐     ▼                ▼
    │   Worker OCR    │  │Worker Grading│  ┌──────────────┐ ┌──────────────────┐
    │    (Python)     │  │   (Python)   │  │Worker TCG API│ │Worker TCG Predict│
    └────────┬────────┘  └──────┬───────┘  │   (Python)   │ │    (Python)      │
             │                  │          └──────┬───────┘ └────────┬─────────┘
             └──────────────────┴─────────────────┴──────────────────┘
                                                  │
                                                  ▼
                                       ┌─────────────────────┐
                                       │      PostgreSQL      │
                                       │   (source de vérité) │
                                       └─────────────────────┘

                    ┌─────────────────────────┐
                    │  Worker TCG Scraping     │  ← pas de queue Redis
                    │  (APScheduler / cron)    │     déclenchement interne
                    └──────────┬──────────────┘
                               │
                               ▼
                      Marketplaces externes
                      (Cardmarket, eBay, TCGPlayer)
                               │
                               ▼
                           PostgreSQL
```

**Format d'un message dans la queue `ocr`** :

```json
{
  "job_id": "uuid-abc-123",
  "user_id": "user-456",
  "image_url": "s3://collectionr-tmp/scans/user-456/card-xyz.jpg",
  "submitted_at": "2026-06-26T10:00:00Z"
}
```

**Pattern de consommation Python** (commun à tous les workers avec queue) :

```python
import os
import redis
from rq import Queue, Worker

redis_conn = redis.from_url(os.environ["REDIS_URL"])
queue = Queue("ocr", connection=redis_conn)

# Écoute en continu — exécute process_job() à chaque message reçu
worker = Worker([queue], connection=redis_conn)
worker.work()
```

---

## 5. Lien avec l'Architecture Runtime A4 — Pods K3s

Dans le cluster K3s, chaque worker est déployé en tant que **Pod indépendant**. Cette isolation permet de les scaler séparément selon la charge réelle.

```
Cluster K3s
│
├── Namespace: collectionr-workers
│   ├── Deployment: ocr-worker            (scalable — dépend de la charge GPU)
│   ├── Deployment: grading-worker        (scalable)
│   ├── Deployment: tcg-api-worker        (1 replica — sync périodique)
│   ├── Deployment: tcg-scraping-worker   (1 replica — cron interne)
│   └── Deployment: tcg-prediction-worker (scalable — dépend de la charge)
│
├── Namespace: collectionr-infra
│   ├── StatefulSet: redis                (BullMQ — file de tâches)
│   └── StatefulSet: postgresql           (source de vérité des données)
│
└── Namespace: collectionr-api
    └── Deployment: backend-typescript    (API HTTP — point d'entrée client)
```

**Règles de communication entre Pods** :

| De | Vers | Port | Raison |
|---|---|---|---|
| Backend TypeScript | Redis | 6379 | Publier les jobs dans les queues |
| Workers Python | Redis | 6379 | Consommer les jobs |
| Workers Python | PostgreSQL | 5432 | Écrire les résultats |
| Backend TypeScript | PostgreSQL | 5432 | Lire les résultats et les exposer au client |

**Important** : les workers Python **n'exposent aucun port HTTP**. Ils ne sont pas joignables depuis l'extérieur du cluster. Seul le backend TypeScript est accessible via un Ingress K3s.

**Scalabilité** : les workers OCR et Grading peuvent être configurés avec un `HorizontalPodAutoscaler` (HPA) pour monter en charge automatiquement lors des pics de scan.

---

## 6. Note sur le modèle d'inférence OCR (placeholder)

> **Ce modèle n'est pas encore fixé. Le choix définitif sera fait à l'issue du benchmark — Roadmap Étape 2.**
> Voir [`model_evaluation/evaluation.md`](../AI/model_evaluation/evaluation.md) pour les critères et seuils de décision.

Le fichier `workers/ocr/inference.py` contient actuellement un stub. Il sera remplacé par l'implémentation concrète une fois le modèle retenu.

**Candidats en cours d'évaluation** :

| Modèle | Architecture | GPU recommandé | Coût estimé/mois |
|---|---|---|---|
| YOLOv10 + PaddleOCR | Pipeline détection + OCR | NVIDIA T4 | ~307 $ |
| Florence-2 | VLM zero/few-shot | NVIDIA L4 | ~491 $ |
| Qwen2.5-VL-7B | VLM multimodal | NVIDIA L4 | ~491 $ |
| olmOCR | OCR spécialisé documents | NVIDIA L4 | ~491 $ |

**Recommandation provisoire** (voir [`finops/spike-finops.md`](../AI/finops/spike-finops.md)) :

- **MVP** : YOLOv10 + PaddleOCR — meilleur ratio coût / vitesse / simplicité de déploiement
- **Fallback qualité** : Qwen2.5-VL sur les cartes ambiguës ou mal lues

**Contrat d'interface** que `inference.py` devra respecter quel que soit le modèle retenu :

```python
def run_inference(image_path: str) -> dict:
    """
    Entrée  : chemin ou URL de l'image de la carte
    Sortie  : champs extraits structurés en dict

    Ce contrat garantit que le reste du pipeline (postprocessing, écriture PG)
    ne change pas lorsqu'on change de modèle.
    """
    return {
        "name": "Pikachu",
        "hp": 60,
        "types": ["Lightning"],
        "attacks": [
            {"name": "Thunder Shock", "cost": ["Lightning"], "damage": 10}
        ],
        "card_number": "58/102",
        "set": "Base Set",
        "rarity": "Common",
        "confidence": 0.94
    }
```

Une fois le benchmark terminé et le modèle validé (Roadmap Étape 3), remplacer le stub par l'implémentation réelle et retirer cette note.
