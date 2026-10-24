# Microservice TCG

Socle technique FastAPI du microservice TCG de Collectionr (COLLR-498 à COLLR-501).
Il expose uniquement `GET /health` : aucune route métier, aucune synchronisation de cartes, aucun
worker pour l'instant. Il est indépendant du backend NestJS (`backend/`) et se connecte à la
**même base PostgreSQL partagée** (source de vérité), via `psycopg` 3.

## Prérequis

- Python ≥ 3.11
- Une base PostgreSQL accessible (instance fournie par DevOps — cf. `devops/README.md`)

## Structure

```text
tcg/
├── pyproject.toml            # dépendances + configuration Ruff / Black / Pytest
├── .env.example              # variables d'environnement documentées
├── src/tcg_service/
│   ├── main.py               # point d'entrée FastAPI (create_app / app_factory)
│   ├── config.py             # configuration validée (Pydantic Settings)
│   ├── database.py           # pool de connexions psycopg 3
│   ├── routers/              # routes HTTP (health)
│   ├── services/             # logique applicative (HealthService)
│   └── models/               # schémas Pydantic (HealthResponse)
└── tests/                    # tests unitaires (mocks) + tests/integration (PostgreSQL réel)
```

## Installation

Depuis le dossier `tcg/` :

```bash
python3 -m venv .venv
source .venv/bin/activate            # Windows : .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env                 # puis renseigner DATABASE_URL
```

`.env` est ignoré par Git : ne jamais le committer.

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
| `HEALTH_CHECK_TIMEOUT` | non | `3` | Délai maximal du contrôle PostgreSQL de `/health`, en secondes. |

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

Le service exécute un `SELECT 1` sur PostgreSQL (timeout `HEALTH_CHECK_TIMEOUT`).

PostgreSQL disponible — `200` :

```json
{
  "status": "ok",
  "service": "tcg",
  "environment": "dev",
  "timestamp": "2026-10-09T10:00:00Z",
  "checks": { "api": "up", "database": "up" }
}
```

PostgreSQL indisponible — `503` : même format avec `"status": "degraded"` et
`"database": "down"`. La réponse ne contient jamais d'identifiant ni de message d'erreur ; seul le
type d'exception est journalisé.

## Qualité

```bash
ruff check .                 # lint
black --check .              # vérification du formatage (black . pour corriger)
pytest                       # tests unitaires (aucune base requise)
pytest --cov                 # avec couverture (seuil 70 %)
```

Ruff ne fait que du lint (pas de `ruff format`) : Black est le seul formateur.

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
