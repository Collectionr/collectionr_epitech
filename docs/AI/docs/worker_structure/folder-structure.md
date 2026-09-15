# Organisation des dossiers — Workflow IA (Worker OCR + Redis + Shared Volume)

> **Statut : Première vision — à valider par des tests**
>
> Ce document représente une **proposition initiale** d'organisation. L'architecture décrite ici n'a pas encore été testée en conditions réelles. Elle doit être considérée comme un point de départ à affiner une fois les premiers tests d'intégration effectués entre le Backend, Redis et le Worker OCR.
>
> Toute modification issue des tests doit être répercutée dans ce document.

---

## But du document

Ce document propose une organisation concrète des dossiers pour faire fonctionner ensemble le **Backend**, le **Worker OCR** et **Redis**, en s'appuyant sur un volume partagé pour les fichiers d'images et de résultats.

---

## 1. Vue d'ensemble du workflow

```
Backend
  │
  ├──── 1. Dépose l'image dans le Shared Volume   ──▶  shared_volume/jobs/{job_id}/input.jpg
  │
  └──── 2. Envoie le job_id dans Redis            ──▶  queue: ocr  { job_id, image_path }
                                                              │
                                                             ▼
                                                       Worker OCR (GPU)
                                                              │
                                              3. Lit l'image via le job_id
                                                              │
                                              4. Fait tourner le modèle OCR
                                                              │
                                              5. Écrit le résultat JSON
                                                 ──▶  shared_volume/jobs/{job_id}/result.json
                                                              │
                                              6. Met à jour le statut dans Redis
                                                 ──▶  queue: ocr  { job_id, status: "done" }
                                                              │
                                                             ▼
Backend
  │
  └──── 7. Reçoit le statut "done" depuis Redis
  └──── 8. Lit le résultat depuis le Shared Volume ──▶  shared_volume/jobs/{job_id}/result.json
```

---

## 2. Structure du Shared Volume

Le Shared Volume est le **seul endroit où les fichiers transitent** entre le Backend et le Worker. Personne ne s'envoie de fichiers directement — tout passe par ce dossier commun.

```
shared_volume/
└── jobs/
    └── {job_id}/               ← un dossier par job (nommé avec le job_id Redis)
        ├── input.jpg            ← image déposée par le Backend
        ├── result.json          ← résultat OCR écrit par le Worker
        └── meta.json            ← métadonnées (user_id, timestamp, statut)
```

**Exemple concret** :

```
shared_volume/
└── jobs/
    └── a3f8c1d2-4e56-7890-abcd-ef1234567890/
        ├── input.jpg
        ├── result.json
        └── meta.json
```

**Contenu de `meta.json`** :

```json
{
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "user_id": "user-123",
  "status": "pending",
  "submitted_at": "2026-06-26T10:00:00Z"
}
```

**Contenu de `result.json`** (écrit par le Worker après inférence) :

```json
{
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "status": "done",
  "extracted_at": "2026-06-26T10:00:04Z",
  "data": {
    "name": "Pikachu",
    "hp": 60,
    "types": ["Lightning"],
    "attacks": [
      { "name": "Thunder Shock", "cost": ["Lightning"], "damage": 10 }
    ],
    "card_number": "58/102",
    "set": "Base Set",
    "rarity": "Common",
    "confidence": 0.94
  }
}
```

> **Règle importante** : chaque dossier `{job_id}/` est supprimé après que le Backend a récupéré le résultat. Le volume ne sert pas de stockage permanent.

---

## 3. Structure du Worker OCR

```
workers/
└── ocr/
    ├── consumer.py          ← écoute Redis, reçoit les job_id
    ├── inference.py         ← charge le modèle et analyse l'image
    ├── postprocessing.py    ← structure le résultat brut en JSON métier
    └── volume.py            ← lit / écrit dans le Shared Volume
```

**Responsabilité de chaque fichier** :

| Fichier | Ce qu'il fait |
|---|---|
| `consumer.py` | Se connecte à Redis, écoute la queue `ocr`, reçoit les messages `{ job_id }` |
| `volume.py` | Lit `input.jpg` depuis `shared_volume/jobs/{job_id}/`, écrit `result.json` |
| `inference.py` | Passe l'image au modèle OCR, retourne le texte brut extrait |
| `postprocessing.py` | Transforme le texte brut en JSON structuré (nom, HP, attaques…) |

---

## 4. Structure des messages Redis

Deux types de messages circulent dans la queue `ocr`.

### Message entrant (Backend → Redis → Worker)

```json
{
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "image_path": "jobs/a3f8c1d2-4e56-7890-abcd-ef1234567890/input.jpg"
}
```

### Message sortant (Worker → Redis → Backend)

```json
{
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "status": "done"
}
```

Les statuts possibles :

| Statut | Signification |
|---|---|
| `pending` | Le job est dans la queue, pas encore traité |
| `processing` | Le Worker a commencé l'inférence |
| `done` | Le résultat est écrit dans le Volume |
| `error` | Le Worker a rencontré une erreur |

---

## 5. Organisation globale des dossiers du projet

En combinant le dépôt workers, le volume partagé et Redis :

```
collectionr-workers/              ← code Python des workers
│
├── workers/
│   ├── ocr/
│   │   ├── consumer.py
│   │   ├── inference.py
│   │   ├── postprocessing.py
│   │   └── volume.py
│   └── grading/
│       ├── consumer.py
│       └── grader.py
│
├── shared/
│   ├── redis_client.py           ← connexion Redis partagée
│   ├── db.py                     ← connexion PostgreSQL partagée
│   └── config.py                 ← variables d'environnement
│
└── docker/
    └── Dockerfile.ocr            ← image GPU du worker

shared_volume/                    ← volume monté sur le Backend ET le Worker OCR
└── jobs/
    └── {job_id}/
        ├── input.jpg
        ├── result.json
        └── meta.json
```

---

## 6. Cycle de vie complet d'un job OCR

```
 Étape  │ Acteur          │ Action
────────┼─────────────────┼──────────────────────────────────────────────────
  1     │ Backend         │ Reçoit POST /scan avec l'image
  2     │ Backend         │ Génère un job_id unique (UUID)
  3     │ Backend         │ Écrit l'image dans shared_volume/jobs/{job_id}/input.jpg
  4     │ Backend         │ Publie { job_id } dans la queue Redis "ocr"
  5     │ Redis           │ Garde le job en attente
  6     │ Worker OCR      │ Consomme le job depuis Redis
  7     │ Worker OCR      │ Lit input.jpg depuis shared_volume/jobs/{job_id}/
  8     │ Worker OCR      │ Fait tourner le modèle d'inférence
  9     │ Worker OCR      │ Écrit result.json dans shared_volume/jobs/{job_id}/
 10     │ Worker OCR      │ Publie { job_id, status: "done" } dans Redis
 11     │ Backend         │ Reçoit le statut "done" depuis Redis
 12     │ Backend         │ Lit result.json depuis shared_volume/jobs/{job_id}/
 13     │ Backend         │ Renvoie les données au client
 14     │ Backend         │ Supprime shared_volume/jobs/{job_id}/ (nettoyage)
```

---

## 7. Points à valider par les tests

Cette organisation est une **première vision**. Plusieurs hypothèses doivent être confirmées avant de la considérer comme définitive.

| Point à tester | Question ouverte |
|---|---|
| Montage du Shared Volume | Le volume est-il bien accessible en lecture/écriture depuis le Backend ET le container GPU Worker en même temps ? |
| Latence du Volume | Le délai entre l'écriture de `result.json` par le Worker et la lecture par le Backend est-il acceptable ? |
| Nommage par `job_id` | Les collisions entre jobs concurrents sont-elles évitées en conditions de charge réelle ? |
| Nettoyage des fichiers | La suppression du dossier `{job_id}/` après lecture est-elle bien déclenchée même en cas d'erreur ou de timeout ? |
| Format de `result.json` | Le format proposé couvre-t-il tous les champs nécessaires au Backend ? À ajuster selon les retours du benchmark OCR. |
| Statuts Redis | Les transitions de statut (`pending → processing → done / error`) sont-elles suffisantes ou faut-il des statuts intermédiaires ? |
| Gestion des erreurs | Si le Worker crash en cours d'inférence, le job reste-t-il bloqué en statut `processing` dans Redis indéfiniment ? |

> Ces questions seront tranchées lors des tests d'intégration. Ce document sera mis à jour en conséquence.
