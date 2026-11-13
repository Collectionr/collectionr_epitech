# Worker OCR

Worker Python du pipeline OCR de Collectionr (COLLR-729). Il consomme les jobs d'une file Redis,
exécute l'inférence sur chacun, puis publie le statut et le résultat dans Redis.

Il est **indépendant de l'API** : il n'expose aucune route HTTP et ne connaît que Redis. Si l'API
s'arrête, il continue de vider la file ; s'il s'arrête, les jobs attendent dans la file.

> **État actuel** : socle et file d'attente. L'inférence est simulée par un moteur factice (`stub`),
> qui n'ouvre pas l'image. Le modèle réel (COLLR-736), l'API FastAPI (COLLR-742) et la
> conteneurisation (COLLR-749) font l'objet de tickets dédiés.

## Fonctionnement

```text
Producteur (API)                    Redis OCR                         Worker OCR
      │                                                                    │
      ├─ SET   task:ocr:{job_id}:status = pending                          │
      ├─ LPUSH queue:ocr:pending  {job_id, image_path}                     │
      │                                  └────── BLMOVE (le plus ancien) ──▶│
      │                                                                    ├─ status = processing
      │                                                                    ├─ inférence
      │                                  ◀── SET result:ocr:{job_id} ──────┤
      │                                  ◀── status = done | error ────────┤
      ◀─ GET status / result
```

- **File FIFO** : le producteur ajoute en tête de la liste `queue:ocr:pending`, le worker prend en
  queue. Premier arrivé, premier traité, un job à la fois.
- **Aucun job perdu** : prendre un job le déplace, dans la même commande atomique, vers
  `queue:ocr:processing`. Il n'en sort qu'une fois son résultat enregistré.

### Contrat Redis

Clés (cf. `docs/stack-technique.md` §8) — elles sont fixes, définies dans `app/jobs/keys.py` :

| Clé | Type | Écrite par | Contenu |
| --- | --- | --- | --- |
| `queue:ocr:pending` | liste | producteur | jobs en attente (JSON) |
| `queue:ocr:processing` | liste | worker | job en cours de traitement |
| `task:ocr:{job_id}:status` | chaîne | producteur puis worker | `pending`, `processing`, `done`, `error` |
| `result:ocr:{job_id}` | chaîne | worker | résultat du job (JSON) |
| `task:ocr:{job_id}:attempts` | entier | worker | nombre de démarrages du job (usage interne) |

Statuts, résultats et compteurs expirent après `OCR_RESULT_TTL` secondes : Redis OCR n'est pas un
stockage métier.

**Message d'un job** (poussé par le producteur) :

```json
{ "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890", "image_path": "jobs/a3f8c1d2-…/input.jpg" }
```

- `job_id` : 1 à 64 caractères parmi `A-Z a-z 0-9 _ -` (un UUID convient).
- `image_path` : chemin de l'image, relatif au Shared Volume.
- Le producteur écrit le statut `pending` **avant** de pousser le job. Les champs supplémentaires
  sont ignorés ; un message invalide est journalisé puis supprimé.

**Résultat** (`result:ocr:{job_id}`) :

```json
{
  "job_id": "a3f8c1d2-4e56-7890-abcd-ef1234567890",
  "status": "done",
  "data": { "engine": "stub", "image_path": "jobs/a3f8c1d2-…/input.jpg" },
  "error": null,
  "started_at": "2026-11-13T11:07:29.347469Z",
  "finished_at": "2026-11-13T11:07:29.848182Z",
  "duration_ms": 501
}
```

En cas d'échec, `status` vaut `error`, `data` vaut `null` et `error` contient `code` et `message` :

| `error.code` | Cause |
| --- | --- |
| `inference_failed` | le moteur n'a pas pu traiter l'image |
| `internal_error` | erreur inattendue pendant l'inférence (détail dans les logs uniquement) |
| `max_attempts_exceeded` | le worker s'est arrêté trop de fois sur ce job |

Le contenu de `data` sera défini avec le modèle réel et le contrat backend ↔ Worker OCR (COLLR-622).

## Structure

```text
microservices/worker-ocr/
├── pyproject.toml            # dépendances + configuration Ruff / mypy / Pytest / couverture
├── requirements.txt          # versions épinglées (exécution), générées depuis pyproject.toml
├── requirements-dev.txt      # versions épinglées (exécution + outils de dev)
├── .env.example              # variables d'environnement documentées
├── app/
│   ├── main.py               # point d'entrée : configuration, câblage, signaux d'arrêt
│   ├── core/                 # configuration validée, logs JSON, client Redis
│   ├── jobs/                 # contrat des jobs, file FIFO, statut/résultat, boucle de traitement
│   └── inference/            # interface du moteur d'inférence + moteur factice
├── scripts/
│   └── enqueue_jobs.py       # test manuel de la file, sans API
├── tests/                    # miroir de app/ et scripts/ (Redis en mémoire, aucune infra requise)
└── Models/                   # notebooks d'évaluation des modèles OCR (COLLR-532)
```

Un nouveau modèle s'ajoute dans `app/inference/` en implémentant `InferenceEngine`
(`load()` une fois au démarrage, `predict()` par image), puis en le déclarant dans `factory.py` et
dans les valeurs de `OCR_MODEL`.

## Installation

Python 3.12 ou plus. Depuis `microservices/worker-ocr/` :

```bash
python3 -m venv .venv                # Windows : py -3.13 -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install -r requirements-dev.txt  # versions épinglées
cp .env.example .env                 # puis renseigner REDIS_URL
```

`.env` est ignoré par Git : ne jamais le committer.

Après une modification des dépendances dans `pyproject.toml`, régénérer les deux fichiers avec
[uv](https://docs.astral.sh/uv/) et committer le résultat :

```bash
uv pip compile pyproject.toml --universal --python-version 3.12 -o requirements.txt
uv pip compile pyproject.toml --extra dev --universal --python-version 3.12 -c requirements.txt -o requirements-dev.txt
```

## Configuration

Les variables sont lues dans l'environnement, puis dans `.env`. Elles sont validées au démarrage
(`app/core/config.py`) ; une valeur invalide empêche le démarrage.

| Variable | Obligatoire | Défaut | Description |
| --- | --- | --- | --- |
| `LOG_LEVEL` | non | `info` | `fatal`, `error`, `warn`, `info`, `debug`, `trace` (mêmes valeurs que le backend). |
| `REDIS_URL` | **oui** | — | `redis://[:<mot_de_passe>@]<hote>:<port>/<base>` (`rediss://` pour TLS). Instance Redis OCR. |
| `REDIS_CONNECT_TIMEOUT` | non | `5` | Délai de connexion à Redis, en secondes. |
| `OCR_MODEL` | non | `stub` | Moteur d'inférence chargé au démarrage. Seul `stub` (factice) existe pour l'instant. |
| `OCR_STUB_DELAY` | non | `0` | Moteur factice : durée d'inférence simulée par job, en secondes (0-60). |
| `OCR_QUEUE_BLOCK_TIMEOUT` | non | `5` | Durée d'une lecture bloquante de la file, en secondes (1-60). C'est aussi le délai maximal avant qu'un worker inactif prenne en compte une demande d'arrêt. |
| `OCR_RESULT_TTL` | non | `3600` | Durée de vie d'un statut et d'un résultat dans Redis, en secondes (60-86400). |
| `OCR_JOB_MAX_ATTEMPTS` | non | `3` | Nombre maximal de démarrages d'un job avant de le passer en `error` (1-10). |

## Démarrage

```bash
python -m app.main
```

Le worker démarre même si Redis est indisponible : il le signale dans les logs et réessaie.
`Ctrl+C` ou `SIGTERM` l'arrête proprement, une fois le job en cours terminé.

## Tester la file avec le script

Le script joue le rôle du producteur (ce que fera l'API) : il pousse des jobs, puis suit leur statut
et affiche leur résultat. Il faut un Redis ; en local, par exemple :

```bash
docker run -d --rm --name redis-ocr-local -p 127.0.0.1:6379:6379 redis:7.4-alpine
```

avec `REDIS_URL=redis://127.0.0.1:6379/0` dans `.env` (sous Windows, `localhost` ajoute environ
2 secondes à chaque connexion : préférer `127.0.0.1`).

Dans un premier terminal, le worker (`OCR_STUB_DELAY=0.5` rend les étapes visibles) :

```bash
python -m app.main
```

Dans un second, le script :

```bash
python -m scripts.enqueue_jobs --count 5 --failures 2
```

```text
queued      job 1/5  ec5b073c-0f3c-4b06-9f8b-d0076e066c1b
…
processing  job 1/5  ec5b073c-0f3c-4b06-9f8b-d0076e066c1b
error       job 1/5  ec5b073c-0f3c-4b06-9f8b-d0076e066c1b
…
  #  status      duration  error
  1  error         501 ms  inference_failed
  2  error         501 ms  inference_failed
  3  done          500 ms  -
  4  done          501 ms  -
  5  done          500 ms  -

expected outcome for every job: yes
processed in FIFO order:        yes
```

| Option | Rôle |
| --- | --- |
| `--count N` | nombre de jobs à pousser (défaut 3) |
| `--failures N` | les N premiers jobs simulent un échec d'inférence (nom de fichier `fail.jpg`) |
| `--timeout S` | temps d'attente maximal du worker, en secondes (défaut 30) |
| `--no-wait` | pousse les jobs et rend la main, sans suivre leur traitement |

Code de sortie : `0` si tous les jobs se terminent comme attendu et dans l'ordre, `1` sinon, `2` si
Redis est injoignable.

Scénarios à rejouer pour vérifier l'indépendance et la robustesse :

| Scénario | Comment | Résultat attendu |
| --- | --- | --- |
| Worker arrêté | `--no-wait`, puis démarrer le worker | les jobs attendent, puis sont traités dans l'ordre |
| Job en échec | `--failures 1` | le job passe en `error`, les suivants sont traités |
| Arrêt brutal en plein job | tuer le processus, puis le relancer | le job interrompu est repris en premier (`attempt: 2`) |
| Coupure de Redis | arrêter puis relancer Redis | `Redis unavailable, retrying` dans les logs, puis reprise |
| Arrêt propre | `Ctrl+C` ou `docker stop` pendant un job | le job se termine, puis `Worker stopped` |

Un job peut aussi être poussé à la main :

```bash
redis-cli LPUSH queue:ocr:pending '{"job_id":"manuel-1","image_path":"jobs/manuel-1/input.jpg"}'
redis-cli GET task:ocr:manuel-1:status
redis-cli GET result:ocr:manuel-1
```

## Logs

Tous les logs sortent en **JSON, une ligne par événement, sur stdout** (S05), au niveau `LOG_LEVEL`
et au même format que le backend et le microservice TCG :

```json
{"time": "2026-11-13T11:07:14.166Z", "level": "info", "service": "worker-ocr", "logger": "app.jobs.consumer", "msg": "Job finished", "job_id": "81c9946c-f762-49f1-9e4e-ed472b2a71c4", "status": "done", "duration_ms": 500, "error_code": null}
```

| Message | Niveau | Champs |
| --- | --- | --- |
| `Worker started` / `Worker stopped` | info | `engine` |
| `Job started` | info | `job_id`, `attempt` |
| `Job finished` | info | `job_id`, `status`, `duration_ms`, `error_code` |
| `Invalid job message dropped` | error | `message_size` |
| `Unexpected error during inference` | error | `job_id`, `exc_type`, `stack_trace` |
| `Job abandoned after too many attempts` | error | `job_id`, `max_attempts` |
| `Interrupted jobs put back in the queue` | warn | `jobs` |
| `Redis unavailable, retrying` | warn | `error_type` |
| `Shutdown requested` | info | `signal` |

Une exception n'est journalisée **que par son type** et sa pile d'appels, jamais par son message :
un message d'erreur Redis peut contenir l'hôte ou l'URL de l'instance. Aucun secret ni URL de
connexion n'apparaît dans les logs.

## Qualité

Ruff pour le lint et le formatage, mypy en mode strict pour le typage, Pytest pour les tests
(Redis en mémoire avec `fakeredis` : aucune infrastructure requise).

```bash
ruff check .                 # lint
ruff format --check .        # vérification du formatage (ruff format . pour corriger)
mypy                         # typage statique strict (app/, scripts/ et tests/)
pytest --cov                 # tests unitaires + couverture (seuil 50 %, périmètre Python)
```

Le code (identifiants, commentaires, messages de log) est en anglais ; la documentation en français.

## Limites connues

- **Un seul worker à la fois.** Au démarrage, le worker reprend tous les jobs de
  `queue:ocr:processing` : avec plusieurs réplicas, il reprendrait aussi ceux qu'un autre worker
  est en train de traiter. À revoir avant de répliquer le worker (bail par job, ou Redis Streams
  comme le microservice TCG).
- **Un job repris est rejoué en entier** : le traitement doit rester rejouable sans effet de bord.
- **Statut `pending` limité par le TTL** : un job resté en file plus longtemps que `OCR_RESULT_TTL`
  n'a plus de statut tant que le worker ne l'a pas pris.
- **Pas de notification** : le producteur lit le statut dans Redis ; aucun message n'est publié
  quand un job se termine.
