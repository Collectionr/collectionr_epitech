# Convention de logs — CollectionR

**Pourquoi** : tous nos services écrivent leurs logs **dans le même format**. On peut ainsi les lire ensemble avec Stern
aujourd'hui, les interroger dans Loki/Grafana en Staging (`docs/devops/D04-observabilité-slo.md`), et **suivre un traitement
d'un service à l'autre** grâce au `job_id`.

> Proposée par le DevOps, validée par le lead Back et le lead IA (réunion de novembre 2026).

---

## 1. Règles

1. **Une ligne JSON par événement**, écrite sur la **sortie standard** (stdout). Jamais de fichier de log dans le conteneur :
   Kubernetes récupère la sortie standard (`kubectl logs`, Stern, Loki).
2. **Champs obligatoires** sur chaque ligne :

| Champ | Contenu | Exemple |
|---|---|---|
| `time` | Date et heure en UTC, format ISO 8601, en millisecondes | `"2026-11-20T20:44:23.376Z"` |
| `level` | Niveau, en texte : `trace`, `debug`, `info`, `warn`, `error`, `fatal` | `"info"` |
| `service` | Nom du service | `"backend"`, `"tcg"`, `"worker-ocr"` |
| `msg` | Ce qui s'est passé, en une phrase courte | `"Scan received"` |

3. **Champs selon le cas** :

| Champ | Quand | Exemple |
|---|---|---|
| `job_id` | Tout traitement asynchrone (scan OCR, job TCG) : voir §2 | `"3f2b9c1e-…"` |
| `context` (Backend) / `logger` (Python) | Le module qui écrit la ligne (ajouté automatiquement) | `"Bootstrap"` |
| `req`, `res` | Requêtes HTTP (ajoutés automatiquement par le Backend sous `/api/v1`) | — |
| `exc_type`, `stack_trace` / `err` | Une erreur : type et pile d'appels, **côté serveur uniquement** | — |

4. **Choisir le niveau** :

| Niveau | Quand | Exemple |
|---|---|---|
| `debug` | Détail utile pour développer (activé en `development` seulement) | Contenu d'une file Redis |
| `info` | Événement normal | Service démarré, scan terminé |
| `warn` | Anomalie gérée, le service continue | Redis pas encore joignable, nouvel essai |
| `error` | Une opération a échoué | Scan impossible, image illisible |
| `fatal` | Le service s'arrête | Configuration invalide au démarrage |

   Le niveau minimal affiché se règle avec la variable `LOG_LEVEL` (ConfigMap du service).

5. **Jamais dans les logs** : mots de passe, jetons, cookies, clés d'API, contenu d'une image, **adresses IP** et données
   personnelles (S04 §11, S05). Pour désigner un utilisateur : son identifiant (`user_id`), jamais son email.

---

## 2. Le `job_id` : suivre un traitement d'un service à l'autre

1. **Qui le crée** : le service qui **lance** le traitement. Pour un scan : le **Backend**, quand il reçoit l'image.
   Format : **UUID en minuscules** (ex. `3f2b9c1e-7d4a-4c1b-9e2f-5a6b7c8d9e0f`), imposé par le contrat Backend ↔ Worker OCR.
   Les recherches dans les logs (`grep`) étant sensibles à la casse, une majuscule suffirait à « perdre » des lignes.
2. **Comment il circule** : dans le message de job déposé dans Redis et dans le nom du dossier du volume partagé
   (`jobs/{job_id}/`). Format du message : voir `docs/AI/workflow/contrat-backend-worker-ocr.md`.
3. **Qui l'écrit** : **chaque service** qui touche au traitement l'écrit dans **chacune** de ses lignes de log liées à ce
   traitement, sous le nom exact **`job_id`**, y compris en TypeScript (pas `jobId`), pour pouvoir filtrer tous les services
   d'un coup.

### Exemple : un scan suivi du Backend au Worker OCR

```json
{"time":"2026-12-03T10:15:02.120Z","level":"info","service":"backend","job_id":"3f2b9c1e-7d4a-4c1b-9e2f-5a6b7c8d9e0f","msg":"Scan received"}
{"time":"2026-12-03T10:15:02.480Z","level":"info","service":"worker-ocr","job_id":"3f2b9c1e-7d4a-4c1b-9e2f-5a6b7c8d9e0f","msg":"OCR started"}
{"time":"2026-12-03T10:15:04.910Z","level":"info","service":"worker-ocr","job_id":"3f2b9c1e-7d4a-4c1b-9e2f-5a6b7c8d9e0f","msg":"OCR done"}
{"time":"2026-12-03T10:15:05.030Z","level":"info","service":"backend","job_id":"3f2b9c1e-7d4a-4c1b-9e2f-5a6b7c8d9e0f","msg":"Scan result stored"}
```

Retrouver toutes les lignes d'un scan, tous services confondus (exemple avec l'identifiant ci-dessus) :
```bash
stern --namespace development --selector app.kubernetes.io/part-of=collectionr --since 1h --no-follow | grep 3f2b9c1e-7d4a-4c1b-9e2f-5a6b7c8d9e0f
```

---

## 3. Où en est chaque service

| Service | Format (§1) | `job_id` (§2) |
|---|---|---|
| Backend | ✅ `backend/src/shared/infrastructure/logging/CreateLoggerOptions.ts` | ⏳ À ajouter avec le flux de scan (Beta) |
| Microservice TCG | ✅ `microservices/tcg/src/tcg_service/infrastructure/logging/json_logging.py` | ⏳ À ajouter avec les Workers TCG (Beta) |
| Worker OCR | ⏳ À appliquer dès maintenant (en cours d'écriture) | ⏳ Avec le flux de scan (Beta) |
| PostgreSQL, Redis, nginx | Format propre au logiciel, non modifiable : hors convention | — |

> `/health` n'est pas journalisé par le Backend, volontairement : les sondes de K3s l'appellent toutes les quelques secondes.
