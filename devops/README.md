# DevOps — CollectionR

Documentation opérationnelle pour l'équipe Cloud/DevOps : scripts d'installation, manifests Kubernetes, conventions techniques.

> 🆕 **Nouveau dans le projet ?** Commence par le guide [ONBOARDING.md](./ONBOARDING.md) : installation, routine quotidienne, erreurs fréquentes.

---

## Sommaire

1. [Démarrage rapide](#démarrage-rapide)
2. [Secrets à créer avant de déployer](#secrets-à-créer-avant-de-déployer)
3. [Backend](#backend-backend)
4. [Lancer les services](#lancer-les-services-deploysh)
   - [Mode code (devs Front + Back)](#mode-code-devs-front--back)
5. [Migrations Prisma](#migrations-prisma)
6. [Frontend](#frontend)
7. [Microservice TCG](#microservice-tcg-tcg)
8. [Volume partagé OCR](#volume-partagé-ocr-shared-volume-ocr)
9. [Convention de labels Kubernetes](#convention-de-labels-kubernetes)

---

## Démarrage rapide

Pour un poste neuf, dans cet ordre :

1. **Installer K3s** avec le script de ton OS : `devops/scripts/setup-local.sh` (Linux), `setup-wsl2.sh` (Windows/WSL2) ou `setup-macos.sh` (macOS).
2. **Créer les Secrets** → [Secrets](#secrets-à-créer-avant-de-déployer)
3. **Construire et importer l'image Backend** → [Backend](#backend-backend) et [Frontend](#frontend)
4. **Lancer les services** : `./devops/scripts/deploy.sh --light`
5. **Poste neuf uniquement : créer les tables** → [Migrations Prisma](#migrations-prisma)

Vérifier : `./devops/scripts/deploy.sh --status`

---

## Secrets à créer avant de déployer

Les Secrets ne sont jamais versionnés. Chaque membre les crée une fois sur son poste, **avant** les `kubectl apply`.
Les mots de passe sont générés automatiquement : personne n'a besoin de les choisir ni de les noter.

### Créer les Secrets

```bash
# PostgreSQL
kubectl create secret generic postgresql-credentials --namespace development --from-literal=POSTGRES_USER=collectionr --from-literal=POSTGRES_PASSWORD="$(openssl rand -hex 16)" --from-literal=POSTGRES_DB=collectionr_dev

# Redis OCR
kubectl create secret generic redis-ocr-credentials --namespace development --from-literal=password="$(openssl rand -hex 24)"

# Redis TCG
kubectl create secret generic redis-tcg-credentials --namespace development --from-literal=password="$(openssl rand -hex 24)"

# Backend (JWT)
kubectl create secret generic backend-credentials --namespace development --from-literal=JWT_SECRET="$(openssl rand -hex 32)"
```

### Vérifier qu'ils existent

```bash
kubectl get secrets --namespace development
```

### Relire un mot de passe (si besoin, pour lancer un service hors cluster)

```bash
# PostgreSQL
kubectl get secret postgresql-credentials --namespace development -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d; echo

# Redis OCR
kubectl get secret redis-ocr-credentials --namespace development -o jsonpath='{.data.password}' | base64 -d; echo

# Redis TCG
kubectl get secret redis-tcg-credentials --namespace development -o jsonpath='{.data.password}' | base64 -d; echo
```

> ⚠️ Ne jamais modifier le Secret PostgreSQL après le premier démarrage : la base garde l'ancien mot de passe et la connexion échoue.
> ⚠️ Toujours utiliser `-hex` (et non `-base64`) : les caractères `/`, `+`, `=` cassent les URL de connexion.

---
## Backend (`backend`)

Image construite en local (pas de registre pour l'instant), depuis la racine du repo :

```bash
docker build -t collectionr-backend:dev backend/
docker save collectionr-backend:dev | sudo k3s ctr images import -
kubectl apply -f devops/k3s/backend.yaml
```

> ⚠️ macOS (Rancher Desktop / OrbStack) : la commande d'import (`k3s ctr images import`) ne fonctionne pas. Les images Docker sont souvent visibles directement par Kubernetes.
<!-- TODO : vérifier la procédure exacte sur le poste Mac de l'équipe. -->

- Prérequis : les Secrets `postgresql-credentials`, `redis-ocr-credentials` et `backend-credentials` (voir "Secrets").
- Test : `curl -H "Host: api.collectionr.localhost" http://localhost/health`
- ⚠️ `NODE_ENV=production` dans le conteneur : sinon le Backend cherche `pino-pretty` (dépendance de dev absente de l'image) et plante. Le niveau de logs reste réglé par `LOG_LEVEL`.
- Tag `:dev` (pas `:latest`), pour que K3s utilise l'image locale au lieu de la chercher sur Internet.
- Le Pod tourne en utilisateur non-root (`runAsUser: 1000`) avec `fsGroup: 1000`, pour garder le droit d'écrire dans le volume partagé OCR sur tout type de stockage.

---
## Lancer les services (`deploy.sh`)

Depuis n'importe quel dossier du repo, après avoir créé les Secrets et importé les images :

```bash
./devops/scripts/deploy.sh --light   # PostgreSQL + Redis OCR + Redis TCG + Backend (postes 8 Go)
./devops/scripts/deploy.sh           # profil complet (+ Frontend)
./devops/scripts/deploy.sh --status  # affiche le mode actuel, sans rien relancer
./devops/scripts/deploy.sh --help    # aide
```

Ce que fait le script :
- Refuse de tourner si le cluster actif est un cluster k3d.
- Vérifie les Secrets avant de déployer, et indique ceux qui manquent.
- Mémorise le mode choisi (lu par `--status`). En `--light`, retire ce qui n'appartient qu'au profil complet.
- Teste `/health` automatiquement à la fin.
- En cas d'erreur, indique l'étape qui a échoué et quoi vérifier.

Code de sortie : `0` = tout est prêt et `/health` répond · `1` = problème (message d'aide affiché).
Sur un cluster neuf, `--status` indique simplement qu'aucun déploiement n'a encore été fait.

Test manuel, à tout moment :
```bash
curl -H "Host: api.collectionr.localhost" http://localhost/health
```

> Les Workers (OCR, TCG) seront ajoutés au profil en Beta.

### Mode code (devs Front + Back)

Pour coder avec rechargement automatique, Front et Back tournent avec `npm` sur ta machine.
PostgreSQL et Redis restent dans le cluster, joignables par 2 tunnels :

    ./devops/scripts/dev.sh

Détails pas à pas : [ONBOARDING.md — Mode code](./ONBOARDING.md#6-mode-code-devs-front--back).

---
## Migrations Prisma

L'image Backend ne contient pas l'outil Prisma. Sur un **poste neuf** (base vide), on applique les migrations depuis le poste, via un tunnel.
À refaire aussi quand l'équipe Back ajoute une nouvelle migration.

Prérequis : Node.js installé.

**Terminal 1** — ouvrir le tunnel (le laisser ouvert) :
```bash
kubectl port-forward -n development svc/postgresql 5432:5432
```

**Terminal 2** — depuis la racine du repo :
```bash
cd backend
npm ci
export DATABASE_URL="postgresql://collectionr:$(kubectl get secret postgresql-credentials -n development -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)@localhost:5432/collectionr_dev"
npx prisma migrate deploy
unset DATABASE_URL
```

Puis `Ctrl+C` dans le terminal 1.

Vérifier : `kubectl exec -n development postgresql-0 -- psql -U collectionr -d collectionr_dev -c '\dt'`

<!-- TODO : ajouter la commande de seed du lead Back (probablement `npx prisma db seed`), dispo prochainement -->

> En Beta, les migrations seront lancées automatiquement par un Job Kubernetes.

---

## Frontend

Image construite en local, depuis la racine du repo (le contexte est `frontend/`, car le Dockerfile utilise `packages/shared`) :
 
```bash
docker build -f frontend/apps/web/Dockerfile -t collectionr-frontend:dev frontend/
docker save collectionr-frontend:dev | sudo k3s ctr images import -
./devops/scripts/deploy.sh          # le profil complet inclut le Frontend
```
 
> ⚠️ macOS (Rancher Desktop / OrbStack) : la commande d'import (`k3s ctr images import`) ne fonctionne pas. Les images Docker sont souvent visibles directement par Kubernetes.
<!-- TODO : vérifier la procédure exacte sur le poste Mac de l'équipe. -->
 
- Site : `http://collectionr.localhost` — l'API est appelée sur la même adresse (`/api/v1/...`, variable de build `VITE_API_BASE_URL`), l'Ingress envoie `/api` vers le Backend.
- Seule l'appli **web** est déployée : l'appli mobile (`apps/mobile`) tourne sur téléphone/émulateur.
- Port `8080`, utilisateur non-root (`nginx-unprivileged`, uid `101`).
- Test : `curl -H "Host: collectionr.localhost" http://localhost/healthz`
> ⚠️ **Windows/WSL2** : si le navigateur n'affiche rien, ouvrir un tunnel vers Traefik (terminal à laisser ouvert) :
> `kubectl port-forward -n kube-system svc/traefik 8081:80`
> puis ouvrir `http://collectionr.localhost:8081`.

---

## Microservice TCG (`tcg`)

Pas encore déployé : aucun `devops/k3s/tcg.yaml` pour l'instant. À prévoir dans ce manifest :

- ⚠️ `APP_ENV=dev` sur le namespace `development` : l'image démarre avec `APP_ENV=staging` par défaut, ce qui désactive `/docs` et `/openapi.json` (même logique que `NODE_ENV=production` pour le Backend).
- Port `8000`, `/health` hors de tout préfixe (même contrat que le Backend). Image et variables : voir `microservices/tcg/README.md`.

---

## Volume partagé OCR (`shared-volume-ocr`)

Volume d'échange d'images entre le Backend et le Worker OCR.

- Monté **uniquement** sur 2 services :
  - **Backend** : écrit l'image envoyée par l'utilisateur.
  - **Worker OCR** : lit l'image, puis la **supprime** après traitement.
- Chemin de montage : `/data/ocr`, transmis à l'application par la variable `OCR_SHARED_DIR`.
  La valeur de la variable doit être identique au `mountPath`.
- Fichiers nommés en UUID (ex. `/data/ocr/3f2a9c1e-...`) : pas de collision entre deux scans, noms impossibles à deviner.
- Le volume n'est **pas** un stockage permanent : aucun fichier ne doit rester plus de 24h.
  Un nettoyage automatique de secours (CronJob) est prévu, au cas où un worker plante.
- Fonctionne en local (1 nœud). En Staging multi-nœuds, prévoir un stockage `ReadWriteMany`.

### Tester le volume

Deux Pods de test simulent le Backend (`test-ocr-writer`) et le Worker OCR (`test-ocr-reader`).

```bash
# 1. Lancer les Pods de test
kubectl apply -f devops/k3s/tests/test-shared-volume-ocr.yaml

# 2. Le "Backend" écrit un fichier
kubectl exec -n development test-ocr-writer -- sh -c 'echo carte > $OCR_SHARED_DIR/$(cat /proc/sys/kernel/random/uuid)'

# 3. Le "Worker" voit le fichier
kubectl exec -n development test-ocr-reader -- ls /data/ocr

# 4. Le "Worker" supprime le fichier (rien ne doit s'afficher)
kubectl exec -n development test-ocr-reader -- sh -c 'rm /data/ocr/* && ls /data/ocr'

# 5. Vérifier que seuls les 2 Pods de test utilisent le volume
kubectl describe pvc shared-volume-ocr -n development

# 6. Nettoyer (le PVC reste en place)
kubectl delete -f devops/k3s/tests/test-shared-volume-ocr.yaml
```

> ⚠️ Pour modifier le fichier de test, supprimer d'abord les Pods (`kubectl delete -f ...`) : un Pod existant ne peut pas changer de montage.

---

## Convention de labels Kubernetes

Toutes les ressources Kubernetes du projet appliquent la convention standard 
`app.kubernetes.io/*`, dès le premier manifest (namespace `development`) :

| Label | Valeur | Usage |
|---|---|---|
| `app.kubernetes.io/name` | `collectionr` | Nom du projet |
| `app.kubernetes.io/part-of` | `collectionr` | Regroupement logique |
| `app.kubernetes.io/managed-by` | `kubectl` | Outil de déploiement utilisé |
| `app.kubernetes.io/component` | *(variable selon la ressource)* | Type de ressource — ex: `database` pour PostgreSQL, `backend` pour l'API. Non appliqué au namespace lui-même. |

Cette convention permet aux NetworkPolicies, ServiceAccounts et Stern de sélectionner 
les bons Pods sans ambiguïté.

Exemple :
```yaml
metadata:
  labels:
    app.kubernetes.io/name: backend
    app.kubernetes.io/part-of: collectionr
    app.kubernetes.io/component: api
    app.kubernetes.io/managed-by: kubectl
```
