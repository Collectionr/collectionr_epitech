# Contrat Backend ↔ Worker OCR

> **Statut : proposition du backend (COLLR-622) — à valider avec l'équipe Data/IA.**
> Ce contrat suit les **documents projet du Drive** (CDC v4.0, WBS v3.0, Document QA v2.0, Gestion des Risques v3.0), qui font foi. Là où ils sont muets, il complète avec les docs techniques du dépôt.

Ce document est la **référence unique** de ce que s'échangent le backend NestJS et le Worker OCR (Python) : les messages Redis, les fichiers du Shared Volume, les erreurs, les délais et les résultats à faible confiance. Il remplace les §2, §4 et §6 de [`../worker_structure/folder-structure.md`](../worker_structure/folder-structure.md), qui étaient une « première vision ».

Côté backend, le contrat est implémenté dans `backend/src/modules/scan/` (types, validation, règles). Les exemples JSON de [`exemples-contrat-ocr/`](exemples-contrat-ocr) sont **les fixtures des tests du backend** : si ce document et le code divergent, les tests échouent.

## Sommaire

- [0. Sources respectées](#0-sources-respectées)
- [1. Principes](#1-principes)
- [2. Vue d'ensemble](#2-vue-densemble)
- [3. Redis OCR](#3-redis-ocr)
- [4. Shared Volume](#4-shared-volume)
- [5. Documents](#5-documents)
  - [5.1 Job (backend → worker) — ocr:jobs](#51-job-backend--worker--ocrjobs)
  - [5.2 Événement de statut (worker → backend) — ocr:events](#52-événement-de-statut-worker--backend--ocrevents)
  - [5.3 Fichier résultat (worker → backend) — jobs/{job_id}/result.json](#53-fichier-résultat-worker--backend--jobsjob_idresultjson)
- [6. Statuts, erreurs et décisions du backend](#6-statuts-erreurs-et-décisions-du-backend)
  - [6.1 Statuts côté backend](#61-statuts-côté-backend)
  - [6.2 Codes d'erreur](#62-codes-derreur)
  - [6.3 Délais](#63-délais)
  - [6.4 Résultats à faible confiance](#64-résultats-à-faible-confiance)
- [7. Pannes, redelivery et nettoyage](#7-pannes-redelivery-et-nettoyage)
- [8. Ce que le backend fait du résultat](#8-ce-que-le-backend-fait-du-résultat)
- [9. Sécurité et RGPD](#9-sécurité-et-rgpd)
- [10. Correspondance avec le backend](#10-correspondance-avec-le-backend)

---

## 0. Sources respectées

| Source | Ce qu'elle impose au contrat |
|---|---|
| **CDC v4.0 §3.4.1** | Le backend valide l'image (format, taille, lisibilité) puis la dépose dans le Shared Volume et crée la tâche Redis OCR. Le worker extrait **nom, numéro d'extension, rareté**, **écrit les résultats en JSON dans le Shared Volume**, et le backend est notifié (SSE vers le client). La **langue** de la carte est détectée par le modèle. Sous un **seuil de confiance minimal**, la carte est « non identifiée » et une confirmation manuelle est proposée. Correspondance ambiguë : plusieurs propositions. |
| **CDC v4.0 §4.1, §4.2** | Pipeline asynchrone par Redis ; SLA : inférence unitaire **< 4 s**, lot de 9 cartes **< 15 s**. |
| **CDC v4.0 §3.4.1 (périmètre V1)** | Cartes Pokémon **françaises et anglaises**. Unitaire en Alpha (UC-02, non bloquant), lot en Beta (UC-03). |
| **WBS v3.0** | Alpha : `/scan` avec flux SSE, Worker OCR « pipeline de base (Redis OCR, Shared Volume) ». Beta : purge automatique des images du Shared Volume, scan en lot. |
| **Document QA v2.0 §17.1, §17.2** | Purge des images après traitement ; sous le seuil de confiance, **intervention manuelle plutôt qu'une validation automatique erronée**. |
| **Gestion des Risques v3.0** | RT-09 : « seuil de confiance minimum exigé, intervention manuelle en dessous du seuil, **journalisation systématique pour ré-entraînement** ». RT-10 : latence > 4 s, traitement asynchrone avec indicateur de chargement immédiat. RT-16 : le modèle OCR n'est pas encore choisi. |

Le CDC est le seul document du Drive qui dise **où** le worker écrit son résultat : dans le Shared Volume. Les docs techniques du dépôt qui disent « le worker écrit en PostgreSQL » (A02, A03, S03 §8.1, S05, S06, D01) sont donc à aligner (COLLR-755). Cela n'interdit pas au **backend** d'enregistrer le scan en base (`SCANHISTORY`), voir §8.

## 1. Principes

1. **Le backend génère le `job_id`**, dépose l'image dans le Shared Volume sous ce `job_id`, puis crée la tâche dans Redis OCR.
2. **Le worker lit l'image, écrit son résultat en JSON dans le Shared Volume (`result.json`), publie le statut dans Redis, puis supprime l'image.** Redis ne porte que le **statut** (et l'erreur éventuelle), jamais le résultat.
3. **Le worker n'écrit pas en base** pour le scan unitaire : le backend lit le résultat, fait le matching catalogue et décide de ce qu'il enregistre.
4. **Le message de job ne contient aucune donnée utilisateur** (pas de `user_id`) : le worker n'en a pas besoin. Le backend garde lui-même le lien `job_id` → utilisateur.
5. **Tout document est du JSON UTF-8 en `snake_case`**, versionné par `schema_version`. Un lecteur **refuse** un document qui ne respecte pas le contrat (version inconnue, champ en trop, valeur hors bornes) plutôt que de l'interpréter.
6. **Redis OCR est at-least-once** : un message peut être livré deux fois. Le worker et le backend sont **idempotents** sur le `job_id`.
7. **Le volume ne contient que des fichiers temporaires** : l'image (supprimée par le worker) et `result.json` (supprimé par le backend après lecture).

## 2. Vue d'ensemble

```
Backend                          Redis OCR                         Worker OCR
   │ 1. génère job_id                                                    │
   │ 2. écrit jobs/{job_id}/input.<ext>  ──────── Shared Volume ───────▶ │
   │ 3. XADD ocr:jobs {payload: job}  ──▶  ocr:jobs  ──── XREADGROUP ──▶ │ 4. lit le job, vérifie expires_at
   │                                     ocr:events ◀── XADD (processing)│ 5. publie « processing »
   │                                                                     │ 6. lit l'image, fait l'inférence
   │ ◀──────────────── Shared Volume ─── jobs/{job_id}/result.json ──────│ 7. écrit result.json.tmp puis le renomme
   │                                     ocr:events ◀── XADD (done|error)│ 8. publie « done » (ou « error »)
   │                                                                     │ 9. supprime input.<ext>, XACK du job
   │ 10. XREADGROUP ◀── ocr:events
   │ 11. lit result.json, le valide (job_id du dossier = job_id du fichier), supprime jobs/{job_id}/
   │ 12. rapproche du catalogue, notifie le client (SSE)
```

L'ordre 7 → 8 est voulu : **l'événement `done` n'est publié qu'une fois `result.json` complet sur le volume** (écriture dans un fichier temporaire puis `rename`, atomique sur un même volume). Quand le backend reçoit `done`, le fichier existe. L'ordre 8 → 9 aussi : l'utilisateur obtient son résultat sans attendre la suppression de l'image ; si le worker plante entre les deux, le nettoyage de secours du backend s'en charge (§7).

Sur une erreur (`error`), il n'y a pas de `result.json` : le worker publie l'événement, supprime l'image et acquitte le job.

## 3. Redis OCR

| Élément | Valeur |
|---|---|
| Stream des jobs (backend → worker) | `ocr:jobs` |
| Stream des événements (worker → backend) | `ocr:events` |
| Groupe de consommateurs des workers | `ocr-workers` (sur `ocr:jobs`) |
| Groupe de consommateurs du backend | `ocr-backend` (sur `ocr:events`) |
| Champ de l'entrée | un seul, `payload`, qui contient le message en JSON |
| Taille maximale d'un message ou d'un `result.json` | 16 384 octets (au-delà, refusé sans être lu) |
| Taille maximale d'un stream | ≈ 1000 entrées (`XADD … MAXLEN ~ 1000`) |

Exemple : `XADD ocr:jobs MAXLEN ~ 1000 * payload '{"schema_version":1,…}'`.

Redis Streams (et non une liste) parce qu'un job lu par un worker qui plante reste dans la liste des entrées en attente (`XPENDING`) et peut être repris (`XAUTOCLAIM`), alors qu'avec `BLPOP` il serait perdu. Les deux streams sont dans le Redis OCR dédié (`devops/k3s/redis-ocr.yaml`), distinct du Redis TCG.

## 4. Shared Volume

```
<OCR_SHARED_DIR>/                       (backend : /data/ocr, variable déjà posée dans devops/k3s/backend.yaml)
└── jobs/
    └── {job_id}/
        ├── input.<ext>                 ← écrit par le backend, supprimé par le worker
        ├── result.json.tmp             ← écriture en cours par le worker (jamais lu par le backend)
        └── result.json                 ← écrit par le worker (rename), lu puis supprimé par le backend
```

- `job_id` : **UUID en minuscules** (`a3f8c1d2-4e56-7890-abcd-ef1234567890`), pour que le nom de dossier soit identique sur tous les systèmes de fichiers.
- `<ext>` découle du format : `image/jpeg` → `jpg`, `image/png` → `png`, `image/webp` → `webp`. Aucun autre format.
- Les **chemins sont dérivés** du `job_id` (et du format pour l'image), jamais d'un nom de fichier envoyé par le client ni choisi par le worker. Le worker **ne doit ouvrir que `image_path`**, et seulement s'il est exactement égal à `jobs/{job_id}/input.<ext>` : tout autre chemin (`..`, chemin absolu, autre dossier) est un job invalide (`INVALID_JOB`). Le backend ne lit que `jobs/{job_id}/result.json`.
- Les chemins sont **relatifs à la racine du volume** ; chaque pod le monte où il veut.
- Le worker doit pouvoir **écrire** dans `jobs/` (résultat) et **supprimer** l'image : le volume ne peut donc pas être monté en lecture seule côté worker (S06 §2.5 le décrit en lecture seule, à aligner dans COLLR-755).

## 5. Documents

Les exemples complets sont dans [`exemples-contrat-ocr/`](exemples-contrat-ocr).

### 5.1 Job (backend → worker) — `ocr:jobs`

```json
{
  "schema_version": 1,
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "image_path": "jobs/a3f8c1d2-4e56-7890-abcd-ef1234567890/input.jpg",
  "image_mime_type": "image/jpeg",
  "attempt": 1,
  "submitted_at": "2026-11-15T10:00:00.000Z",
  "expires_at": "2026-11-15T10:00:30.000Z"
}
```

| Champ | Type | Règle |
|---|---|---|
| `schema_version` | entier | `1`. Toute autre valeur est refusée. |
| `job_id` | texte | UUID en minuscules. Clé d'idempotence. |
| `image_path` | texte | `jobs/{job_id}/input.<ext>`, ≤ 200 caractères. |
| `image_mime_type` | texte | `image/jpeg`, `image/png` ou `image/webp`, cohérent avec l'extension. |
| `attempt` | entier | `1` au premier essai, `2` pour la reprise ; maximum `2`. |
| `submitted_at` | date | ISO 8601 **avec fuseau** (`Z` ou `+01:00`). |
| `expires_at` | date | ISO 8601 avec fuseau, strictement après `submitted_at`. Passé ce moment, plus personne n'attend la réponse. |

### 5.2 Événement de statut (worker → backend) — `ocr:events`

Trois statuts, un message par transition. Le worker publie `processing` quand il prend le job, puis **exactement un** message final (`done` ou `error`). **Aucun message ne porte le résultat** : un champ `result` dans un événement est refusé.

```json
{
  "schema_version": 1,
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "status": "done",
  "emitted_at": "2026-11-15T10:00:04.200Z"
}
```

| Champ | Type | Règle |
|---|---|---|
| `schema_version`, `job_id` | — | Comme le job. |
| `status` | texte | `processing`, `done` ou `error`. (`pending` et `timeout` n'existent que côté backend, §6.1.) |
| `emitted_at` | date | ISO 8601 avec fuseau. |
| `error` | objet | **Présent si et seulement si** `status = error`. Absent ou `null` sinon. |

#### `error`

```json
{ "code": "NO_CARD_DETECTED", "message": "No card found in the image" }
```

`message` (1 à 200 caractères, sans caractère de contrôle) sert aux **journaux** : **ni chemin du volume, ni donnée utilisateur**. Le texte montré à l'utilisateur dépend du `code`, jamais du `message`.

### 5.3 Fichier résultat (worker → backend) — `jobs/{job_id}/result.json`

C'est ce que le CDC §3.4.1 appelle « les résultats écrits en JSON dans le Shared Volume ». Écrit **uniquement** quand le statut final est `done`.

```json
{
  "schema_version": 1,
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "produced_at": "2026-11-15T10:00:04.100Z",
  "result": {
    "name": "Funécire",
    "set_code": "TWM FR",
    "set_number": "036/167",
    "language": "fr",
    "rarity": "Common",
    "confidence": 0.94,
    "model_version": "qwen2.5-vl-3b-1",
    "processing_ms": 2840
  }
}
```

| Champ | Type | Règle |
|---|---|---|
| `schema_version` | entier | `1`. |
| `job_id` | texte | **Doit être celui du dossier** où le fichier est lu : un fichier qui appartient à un autre job est refusé. |
| `produced_at` | date | ISO 8601 avec fuseau. |
| `result.name` | texte ou `null` | Nom lu sur la carte, tel qu'imprimé (français ou anglais). 1 à 100 caractères. |
| `result.set_code` | texte ou `null` | Code d'extension imprimé (`TWM FR`), pas l'identifiant du catalogue. ≤ 20 caractères. |
| `result.set_number` | texte ou `null` | Numéro imprimé, **zéros et préfixes conservés** (`036/167`, `TG03/TG30`). ≤ 20 caractères. |
| `result.language` | `"fr"`, `"en"` ou `null` | Langue de la carte, **détectée par le modèle** (CDC §3.4.1) ; sert à requêter le bon prix. |
| `result.rarity` | texte ou `null` | Rareté lue (CDC §3.4.1), texte libre ≤ 50 caractères. Le catalogue a ses propres codes (ADR-015) : le rapprochement est le travail du backend. |
| `result.confidence` | nombre | De `0` (une supposition) à `1` (certain). Score global. |
| `result.model_version` | texte | Identifie le modèle et sa version (traçabilité des performances, RT-09). 1 à 64 caractères. |
| `result.processing_ms` | entier ≥ 0 | Durée de l'inférence seule, hors attente dans la file. Sert à suivre le SLA < 4 s. |

Règles communes aux textes lus sur la carte : pas de caractère de contrôle ni invisible, pas d'espace en tête. **Ne pas deviner** : un champ illisible vaut `null` (ou est absent), ce n'est pas une erreur. Si ni le nom ni le numéro n'ont pu être lus, le worker peut écrire un résultat avec `null` partout (le backend le traitera comme « non identifié ») ou publier `error` avec `NO_CARD_DETECTED` quand il ne voit aucune carte.

Les champs `hp`, `types`, `attacks` de la « première vision » ne sont **pas** dans le contrat : le backend identifie la carte par nom + numéro (+ extension, langue, rareté) contre le catalogue, il n'a pas besoin du reste. Ajouter un champ = contrat v2.

## 6. Statuts, erreurs et décisions du backend

### 6.1 Statuts côté backend

```
pending ──▶ processing ──▶ done
   │            │       └─▶ error
   │            └─────────▶ timeout
   └─ (done | error | timeout, si le worker répond sans « processing »)
```

`pending` (en file, rien reçu) et `timeout` (pas de réponse finale avant `expires_at`) sont décidés par le backend. **`done`, `error` et `timeout` sont définitifs.** Tout événement qui ne correspond pas à une transition valide (un `processing` livré deux fois, un `done` qui arrive après le `timeout`) est acquitté et ignoré, avec une ligne de journal.

### 6.2 Codes d'erreur

Le caractère *réessayable* est **fixé par le code**, pas annoncé par le worker : il n'y a pas de champ `retryable`.

| Code | Émis par | Signification | Réessai | Côté utilisateur |
|---|---|---|---|---|
| `INVALID_JOB` | worker | Le message de job viole le contrat (chemin hors de `jobs/{job_id}/`, version inconnue…). | non | « Réessaie plus tard » (bug backend) |
| `IMAGE_NOT_FOUND` | worker | Le fichier n'existe pas dans le volume. | non | « Réessaie plus tard » |
| `IMAGE_UNREADABLE` | worker | Fichier corrompu ou format non décodable. | non | **Scanner de nouveau** avec une autre photo |
| `NO_CARD_DETECTED` | worker | Aucune carte repérée dans l'image. | non | **Scanner de nouveau** |
| `JOB_EXPIRED` | worker | Le worker a pris le job après `expires_at`. | non | « Délai dépassé » |
| `MODEL_UNAVAILABLE` | worker | Modèle non chargé, mémoire GPU insuffisante. | **oui** | « Réessaie plus tard » |
| `INFERENCE_FAILED` | worker | Échec de l'inférence ou du post-traitement. | **oui** | « Réessaie plus tard » |
| `TIMEOUT` | backend | Aucun événement final avant `expires_at`. | non | « Délai dépassé » |
| `INVALID_EVENT` | backend | L'événement reçu viole le contrat. | non | « Réessaie plus tard » |
| `INVALID_RESULT` | backend | `done` reçu mais `result.json` absent, illisible, hors contrat ou d'un autre job. | non | « Réessaie plus tard » |

Le backend **ne réessaie qu'un échec réessayable**, **une seule fois** (`attempt` passe de 1 à 2) et **seulement si `expires_at` n'est pas passé**. Un `TIMEOUT` n'est jamais rejoué : le worker est probablement à l'arrêt et l'utilisateur a déjà attendu tout le délai.

Un document invalide (`INVALID_EVENT`, `INVALID_RESULT`) est journalisé avec **les noms des champs fautifs, jamais leurs valeurs**, puis le job est marqué en erreur : un document mal formé n'est jamais interprété « au mieux ».

### 6.3 Délais

| Valeur | Défaut | Rôle |
|---|---|---|
| SLA d'inférence (CDC §4.2, Document QA §6.1) | **< 4 s** unitaire, **< 15 s** lot de 9 | Objectif de performance, suivi par l'observabilité (D04), pas une limite appliquée par le code. |
| Délai total d'un scan | **30 s** | File d'attente et démarrage à froid compris ; fixe `expires_at = submitted_at + 30 s`. C'est le moment où le backend abandonne et prévient l'utilisateur (RT-10). |
| Essais | **2** | Premier essai compris. |
| Délai de grâce avant nettoyage de secours | **5 min** après `expires_at` | Le backend supprime alors `jobs/{job_id}/` si personne ne l'a fait. |

Valeurs **provisoires** : le modèle OCR n'est pas encore choisi (RT-16), à revoir avec les mesures sur le cluster.

### 6.4 Résultats à faible confiance

L'utilisateur **confirme toujours** avant l'ajout à sa collection (CDC §3.4.1, COLLR-623). La confiance décide de ce qu'on lui montre en premier :

| Classe | Condition | Comportement |
|---|---|---|
| `high` | `confidence ≥ 0,85` **et** nom **et** numéro lus | Carte candidate présélectionnée. |
| `low` | `0,5 ≤ confidence < 0,85`, **ou** score élevé mais nom ou numéro manquant | Candidats listés avec l'invitation à vérifier la carte. |
| `unidentified` | `confidence < 0,5`, **ou** ni nom ni numéro lus | « Carte non identifiée » : aucune proposition automatique, **confirmation manuelle proposée** (recherche ou saisie), nouveau scan possible (CDC §3.4.1, Document QA §17.2). |

Pourquoi « nom **et** numéro » pour `high` : le nom seul correspond à une carte par extension, le numéro seul aussi ; ensemble ils désignent une carte. Le CDC demande un « seuil de confiance minimal » sans le chiffrer : 0,85 et 0,5 sont **provisoires**. L'évaluation exige un Exact Match ≥ 0,80 sur les champs critiques, 0,85 garde une marge. Ils seront recalés sur la distribution réelle des scores du modèle retenu. **Le worker doit donc fournir un score calibré** (un 0,94 doit signifier « juste environ 9 fois sur 10 »), sinon les seuils n'ont aucun sens : à confirmer avec l'équipe Data/IA.

## 7. Pannes, redelivery et nettoyage

| Situation | Comportement |
|---|---|
| Le worker plante en cours d'inférence | Le job reste non acquitté dans `ocr-workers`. Un worker qui redémarre le reprend (`XAUTOCLAIM`) ; s'il est lu après `expires_at`, il répond `JOB_EXPIRED` sans traiter l'image. Si personne ne répond, le backend déclare `TIMEOUT`. |
| Le worker plante pendant l'écriture du résultat | Seul `result.json.tmp` existe : le backend ne le lit jamais et ne reçoit pas `done`. Même cas que ci-dessus. |
| Le même job est livré deux fois | Le worker suit le `job_id` : s'il a déjà un `result.json` valide, il republie `done` sans refaire l'inférence. Le backend ignore tout événement non conforme au §6.1. |
| Le worker plante après `done`, avant de supprimer l'image | Le nettoyage de secours du backend supprime `jobs/{job_id}/` 5 min après `expires_at`. |
| `done` reçu mais `result.json` absent ou invalide | Job en erreur `INVALID_RESULT` ; le dossier est supprimé. |
| Backend arrêté pendant le traitement | Il consomme `ocr:events` avec un groupe : il reprend à son redémarrage, sans perte. Au-delà de `expires_at`, l'événement est ignoré (statut déjà `timeout`) et le nettoyage de secours supprime le dossier. |
| Message illisible ou hors contrat | Acquitté, journalisé (champs seulement), job marqué `INVALID_EVENT` côté backend ; côté worker, `INVALID_JOB`. Jamais de boucle infinie sur un message empoisonné. |

## 8. Ce que le backend fait du résultat

Hors périmètre de ce contrat (tickets COLLR-420 et COLLR-623), mais le contrat est écrit pour le permettre :

1. **Matching catalogue** (CDC §3.4.1) : nom + numéro + extension + langue (+ rareté pour départager) contre PostgreSQL ; correspondance ambiguë = plusieurs propositions.
2. **Enregistrement du scan** : la table `SCANHISTORY` (`schema-sql.md` : `type`, `imageHash`, `detectedCount`, `detectedCards` JSON, `status`) est faite pour cela. Le backend peut y inscrire le résultat (le tableau `detectedCards` accueille aussi le futur scan en lot). Le contrat ne l'impose pas : c'est le backend qui écrit, jamais le worker. Cela répond aussi à la « journalisation systématique pour ré-entraînement » de RT-09 **sans conserver l'image** (seul un hash).
3. **Suppression** de `jobs/{job_id}/` une fois le résultat lu.

## 9. Sécurité et RGPD

- Le worker tourne dans un pod **sans accès réseau externe** (A02 §5, S06 §2.2). Le volume n'est monté que sur les pods du backend et des workers OCR (S06 §2.5).
- Le worker **n'a besoin d'aucune donnée utilisateur** : le job n'en porte pas. Le traitement se limite à la reconnaissance et à l'identification de la carte (S04 §2.4, minimisation).
- Les images sont **supprimées après traitement** (S04 §2.4 et §5, Document QA §17.1) : par le worker dans le flux normal, par le backend en secours après un délai court (S03 §8.2, S06 §2.5).
- Les textes du résultat finissent dans les journaux et dans des requêtes au catalogue : le backend refuse caractères de contrôle, invisibles et longueurs hors bornes avant d'en faire quoi que ce soit.
- Le backend ne fait **jamais confiance** à un document du worker : même vérification stricte que pour une requête HTTP (CDC §4.5, modèle Zero Trust).

## 10. Correspondance avec le backend

| Élément du contrat | Code (`backend/src/modules/scan/`) |
|---|---|
| Constantes partagées (streams, formats, chemins, bornes) | `domain/rules/OcrContract.ts` |
| Délais, essais, seuils de confiance | `domain/rules/OcrPolicy.ts` |
| Statuts et transitions | `domain/value-objects/OcrJobStatus.ts` |
| Codes d'erreur et réessai | `domain/value-objects/OcrFailureCode.ts`, `domain/rules/OcrRetryPolicy.ts` |
| Chemins de l'image et du résultat | `domain/rules/OcrImagePath.ts` |
| Échéance | `domain/rules/OcrJobDeadline.ts` |
| Classe de confiance | `domain/rules/ClassifyOcrResult.ts` |
| Types (job, résultat, fichier résultat, événement) | `domain/entities/OcrMessages.ts` |
| Lecture/écriture validée des trois documents | `application/codecs/OcrMessageCodec.ts` (+ DTO dans `application/dtos/`) |

`serializeOcrEventMessage` et `serializeOcrResultFile` écrivent un document comme le fait un worker : ils servent de **doublure du Worker OCR** aux tests du backend (COLLR-623).
