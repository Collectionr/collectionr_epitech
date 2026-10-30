# Microservice TCG

Socle technique FastAPI du microservice TCG de Collectionr (COLLR-493, durci par COLLR-686).
Il expose uniquement `GET /health` : aucune route métier, aucune synchronisation de cartes, aucun
worker pour l'instant. Il est indépendant du backend NestJS (`backend/`) et se connecte à la
**même base PostgreSQL partagée** (source de vérité), via `psycopg` 3.

**Règle d'écriture en base** : le schéma (tables, colonnes, clés uniques, migrations) est le
**contrat d'interface** généré par le backend (Prisma). Le microservice TCG ne crée, ne migre et ne
modifie aucune table : il transforme les données des API externes et les écrit uniquement dans les
tables de ce contrat (UPSERT idempotents). Pour l'instant il ne fait qu'un `SELECT 1`.

## Prérequis

- Python 3.13 (même version que le pipeline OCR ; figée à `3.13.9` dans le `Dockerfile`)
- Une base PostgreSQL accessible (instance fournie par DevOps — cf. `devops/README.md`)

## Structure

Clean Architecture en 4 couches, alignée sur le backend (cf.
[`docs/microservices/architecture-microservices.md`](../docs/microservices/architecture-microservices.md)).

```text
tcg/
├── pyproject.toml                # dépendances + configuration Ruff / mypy / Pytest / couverture
├── requirements.txt              # versions épinglées (exécution), générées depuis pyproject.toml
├── requirements-dev.txt          # versions épinglées (exécution + outils de dev)
├── .env.example                  # variables d'environnement documentées
├── Dockerfile                    # image multi-arch (x86-64 + ARM64), non-root
├── .lintstagedrc.json            # hook pre-commit : ruff check + ruff format
├── CLAUDE.md                     # conventions du service pour les agents IA
├── src/tcg_service/
│   ├── main.py                   # point d'entrée uvicorn (app_factory)
│   ├── config.py                 # configuration validée (Pydantic Settings)
│   ├── domain/                   # entités et ports — aucun import de framework (bloqué par Ruff)
│   │   ├── entities/             # HealthStatus, DependencyHealth
│   │   └── ports/                # HealthIndicatorPort
│   ├── application/              # cas d'usage (CheckHealthUseCase)
│   ├── infrastructure/
│   │   ├── logging/              # logs JSON sur stdout (JsonFormatter, configure_logging)
│   │   └── persistence/          # pool psycopg 3 (Database), PostgresHealthIndicator
│   └── interface/
│       └── api/                  # FastAPI : app (create_app), routes /health, schémas Pydantic
└── tests/                        # miroir de src/ + tests/integration (PostgreSQL réel)
```

`domain/` n'importe aucun framework (FastAPI, Pydantic, psycopg, redis) : la règle `TID251` de Ruff
le vérifie. Les use cases dépendent de ports (`domain/ports/`), implémentés dans `infrastructure/` et
câblés dans `interface/api/app.py`.

## Installation

Depuis le dossier `tcg/` :

```bash
python3.13 -m venv .venv             # Windows : py -3.13 -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install -r requirements-dev.txt  # versions épinglées
pip install -e . --no-deps           # le package tcg_service lui-même
cp .env.example .env                 # puis renseigner DATABASE_URL
```

`.env` est ignoré par Git : ne jamais le committer.

## Dépendances

`pyproject.toml` déclare les dépendances directes avec des bornes minimales (`>=`). Les versions
réellement installées sont **épinglées** dans `requirements.txt` (exécution, pour l'image Docker) et
`requirements-dev.txt` (exécution + tests/lint, contraint par `requirements.txt` pour garder les
mêmes versions). Deux installations à des dates différentes donnent ainsi le même environnement.

Après une modification des dépendances dans `pyproject.toml`, régénérer les deux fichiers avec
[uv](https://docs.astral.sh/uv/) (`pip install uv`) et committer le résultat :

```bash
uv pip compile pyproject.toml --universal --python-version 3.13 -o requirements.txt
uv pip compile pyproject.toml --extra dev --universal --python-version 3.13 -c requirements.txt -o requirements-dev.txt
```

`--universal` produit un fichier valable sur Linux, macOS et Windows (marqueurs de plateforme, ex.
`uvloop` hors Windows). Ajouter `--upgrade` pour monter de version les paquets déjà épinglés.

## Configuration

Les variables sont lues dans l'environnement, puis dans `.env`. Elles sont validées au démarrage
(`src/tcg_service/config.py`) ; une valeur invalide empêche le démarrage.

| Variable | Obligatoire | Défaut | Description |
| --- | --- | --- | --- |
| `APP_ENV` | non | `dev` | `dev` ou `staging`. En `staging`, `/docs` et `/openapi.json` sont désactivés. |
| `LOG_LEVEL` | non | `info` | `critical`, `error`, `warning`, `info`, `debug`. |
| `DATABASE_URL` | **oui** | — | `postgresql://<utilisateur>:<mot_de_passe>@<hote>:<port>/<base>` — même base que le backend. Sans paramètre Prisma (`?schema=…`). |
| `DATABASE_POOL_MAX` | non | `5` | Taille maximale du pool (1-100). |
| `DATABASE_CONNECT_TIMEOUT` | non | `5` | Délai de connexion en secondes (1-60). |
| `DATABASE_STATEMENT_TIMEOUT` | non | `30` | Délai maximal d'une requête SQL métier (UPSERT des workers), en secondes (1-600). Appliqué à toutes les connexions du pool. |
| `HEALTH_CHECK_TIMEOUT` | non | `3` | Délai maximal du contrôle PostgreSQL de `/health`, en secondes. Limité au seul `SELECT 1` de santé (`SET LOCAL`), sans effet sur les requêtes métier. |

En staging, les variables sont injectées par l'environnement (Secret K3s), pas par un fichier.

## Démarrage

```bash
uvicorn tcg_service.main:app_factory --factory --host 127.0.0.1 --port 8000 --reload
```

Le service démarre même si PostgreSQL est indisponible ; `/health` le signale alors par un 503.
Il est destiné à un usage interne (appelé par le backend), ne pas l'exposer aux clients.

## Endpoint `/health`

```bash
curl -i http://127.0.0.1:8000/health
```

Comme sur le backend (ADR-003), `/health` est un endpoint unique, hors de tout préfixe, qui vérifie
réellement les dépendances (PostgreSQL ici) : `200` si tout est disponible, `503` sinon. Le service
exécute un `SELECT 1` sur PostgreSQL (timeout `HEALTH_CHECK_TIMEOUT`) et mesure sa latence.

La réponse suit **le même contrat que le backend** (`HealthResponseDto`) — PostgreSQL disponible,
`200` :

```json
{
  "status": "ok",
  "checkedAt": "2026-10-30T15:18:26.948Z",
  "dependencies": [{ "name": "database", "status": "up", "latencyMs": 1 }]
}
```

PostgreSQL indisponible — `503` : même format avec `"status": "degraded"` et
`{ "name": "database", "status": "down", "latencyMs": null }`. La réponse ne contient jamais
d'identifiant ni de message d'erreur ; seul le type d'exception est journalisé. Le contrôle Redis
(`cache`) sera ajouté quand Redis TCG sera câblé.

## Logs

Tous les logs (service, `psycopg`, uvicorn) sortent en **JSON, une ligne par événement, sur stdout**
(S05), au niveau `LOG_LEVEL` :

```json
{"time": "2026-10-30T15:18:27.838Z", "level": "warning", "service": "tcg", "logger": "tcg_service.infrastructure.persistence.postgres_health_indicator", "msg": "PostgreSQL health check failed: AdminShutdown"}
```

Les champs passés via `extra=` sont ajoutés tels quels, et une exception (`logger.exception`) est
ajoutée dans `exc_info`. Les logs d'accès uvicorn ne contiennent **pas l'adresse IP du client**
(donnée personnelle) : seulement `http_method`, `http_path` et `status_code`.

## Docker

```bash
docker build -t collectionr-tcg tcg/                                            # architecture locale
docker buildx build --platform linux/amd64,linux/arm64 -t collectionr-tcg tcg/  # multi-arch
docker run --rm -p 8000:8000 -e DATABASE_URL='postgresql://…' collectionr-tcg
```

Image en deux étapes (`python:3.13.9-slim-bookworm`), qui n'installe que `requirements.txt` puis le
package. Elle tourne avec un utilisateur **non-root** (UID/GID numériques `10001`, compatibles
`runAsNonRoot`) et avec `APP_ENV=staging` par défaut (`/docs` désactivé). Toutes les variables de
configuration sont à fournir par l'environnement.

## Qualité

Ruff pour le lint et le formatage, mypy en mode strict pour le typage (l'équivalent du « zéro
`any` » du backend), Pytest pour les tests.

```bash
ruff check .                 # lint
ruff format --check .        # vérification du formatage (ruff format . pour corriger)
mypy                         # typage statique strict (src/ et tests/)
pytest                       # tests unitaires (aucune base requise)
pytest --cov                 # avec couverture (seuil 50 %, cf. Document QA)
```

**Hook pre-commit** : quand un commit contient des fichiers `.py` de `tcg/`, Husky lance
`ruff check --fix` puis `ruff format` dessus (`tcg/.lintstagedrc.json`). Le hook utilise le `ruff`
du venv `tcg/.venv` : il faut donc avoir suivi l'[installation](#installation).

## Vérifier la connexion PostgreSQL

1. Renseigner `DATABASE_URL` dans `.env` (instance partagée DevOps, éventuellement via
   `kubectl port-forward` — voir `devops/README.md`).
2. Démarrer le service, puis `curl -i http://127.0.0.1:8000/health` : `200` et
   `"database": "up"` confirment une connexion réelle.
3. Test d'intégration automatisé (ignoré par défaut) :

   ```bash
   TCG_TEST_DATABASE_URL='postgresql://…' pytest tests/integration
   ```

En cas de `503`, vérifier l'hôte/port, les identifiants, que la base est démarrée et que
`DATABASE_URL` n'inclut pas de paramètre Prisma. Les logs du pool (`psycopg.pool`) détaillent
l'échec de connexion côté serveur.
