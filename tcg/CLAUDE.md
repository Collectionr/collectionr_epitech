# Collectionr — Microservice TCG (`tcg/`)

Complète le [`CLAUDE.md`](../CLAUDE.md) racine pour tout ce qui se trouve dans `tcg/` : en cas de
conflit, ce fichier l'emporte. Service Python interne (appelé par le backend) qui alimentera les
métadonnées et les prix des cartes ; pour l'instant seul `GET /health` existe.

## Stack

- Python **3.13** (figé à `3.13.9` dans le `Dockerfile`) · FastAPI · uvicorn · Pydantic Settings
- PostgreSQL partagé avec le backend via **psycopg 3** (pool `psycopg_pool`)
- Ruff (lint + format) · **mypy strict** (+ plugin `pydantic.mypy`) · Pytest + pytest-cov
- Dépendances : bornes dans `pyproject.toml`, versions épinglées dans `requirements.txt` /
  `requirements-dev.txt` (générés par `uv pip compile --universal`, jamais édités à la main)

## Commandes (depuis `tcg/`, venv `.venv` activé)

```bash
ruff check .                # lint
ruff format --check .       # formatage (ruff format . pour corriger)
mypy                        # typage strict de src/ et tests/
pytest --cov                # tests unitaires + couverture (seuil 50 %)
TCG_TEST_DATABASE_URL='postgresql://…' pytest tests/integration   # PostgreSQL réel
docker build -t collectionr-tcg .
```

Installation et régénération des dépendances : `README.md` (sections « Installation » et
« Dépendances »).

## Invariants

- **Clean Architecture 4 couches** dans `src/tcg_service/` : `domain/`, `application/`,
  `infrastructure/`, `interface/`. `domain/` n'importe aucun framework (FastAPI, Pydantic, psycopg,
  redis) — bloqué par la règle Ruff `TID251`. Les use cases dépendent de **ports** (`Protocol` dans
  `domain/ports/`), implémentés dans `infrastructure/` et câblés dans `interface/api/app.py`.
- **Nommage Python (PEP 8)** : modules et fichiers en `snake_case`, classes en `PascalCase`. La règle
  « fichiers en PascalCase » du CLAUDE.md racine ne concerne que le backend TypeScript.
- **Code en anglais** : identifiants, commentaires, docstrings, messages de log et d'erreur,
  `.env.example`. La documentation (`README.md`, `docs/`) reste en français.
- **Typage strict** : `mypy` sans erreur. Pas de `Any` explicite ; un `# type: ignore` porte toujours
  son code d'erreur (`[call-arg]`…) et n'est gardé que s'il est indispensable.
- **Configuration** : toute variable d'environnement est déclarée et validée dans
  `src/tcg_service/config.py` (`Settings`), documentée dans `.env.example` (source de vérité) et dans
  le tableau du README, avec un défaut sûr. Aucun secret n'a de valeur par défaut.
- **Pas de nombre magique** : ce qui varie selon l'environnement est une variable d'env ; ce qui est
  fixe est une constante nommée dans le module qui l'utilise.
- **Base de données** : le schéma est le contrat d'interface généré par le backend (Prisma). Le
  service ne crée, ne migre et ne modifie aucune table ; il écrit uniquement par UPSERT idempotents.
  `HEALTH_CHECK_TIMEOUT` ne s'applique qu'au `SELECT 1` de santé, `DATABASE_STATEMENT_TIMEOUT` à tout
  le reste.
- **`/health`** : hors de tout préfixe (probes K3s), même contrat que le backend
  (`status`, `checkedAt`, `dependencies[]` avec `name`, `status`, `latencyMs`), `200` ou `503`. Un
  indicateur de santé ne lève jamais d'exception et la réponse ne contient aucun détail d'erreur.
- **Logs** : `logging.getLogger(__name__)` uniquement (jamais `print`), sortie JSON sur stdout
  configurée par `configure_logging` (`infrastructure/logging/`). Jamais de secret, d'URL de
  connexion, d'adresse IP ni de message libpq brut : on journalise le type d'exception.
- **Tests** : `tests/` est le miroir de `src/`. Tests unitaires avec doublures (`FakeDatabase`, faux
  pool…), sans infrastructure réelle ; les tests sur PostgreSQL réel vont dans `tests/integration/`
  (marqueur `integration`, ignorés sans `TCG_TEST_DATABASE_URL`). Couverture **≥ 50 %** (seuil du
  périmètre Python, Document QA), et non le 70 % du backend.

## Invariants du CLAUDE.md racine

| Invariant racine | Dans `tcg/` |
| --- | --- |
| Git / Jira (branches, commits en français, ne jamais push) | ✅ s'applique tel quel |
| Clean Architecture 4 couches, `domain/` sans framework, ports | ✅ (vérifié par Ruff `TID251`) |
| Variables d'env validées + documentées, défaut sûr | ✅ via `config.py` + `.env.example` |
| Pas de nombre magique | ✅ |
| `/health` hors préfixe | ✅ |
| Fichiers en PascalCase | ❌ PEP 8 (`snake_case`) |
| `ConfigureApp.ts`, `EnvironmentVariables.ts`, `AppConstants.ts` | ❌ propres au backend |
| Format d'erreur `AllExceptionsFilter` | ⏳ pas encore de route métier ; à reprendre avec la première |
| Couverture ≥ 70 %, Jest | ❌ Pytest, seuil 50 % |
