# Onboarding — Environnement local CollectionR

Objectif : être opérationnel **en environ 1 heure**, quel que soit ton OS (durées ci-dessous).

Ce guide te dit **quoi faire et dans quel ordre**.
Les détails techniques sont dans [`devops/README.md`](./README.md) : on y renvoie quand il le faut.

Quand une étape dépend de ton OS, elle est toujours présentée dans le même ordre : **Linux → Windows (WSL2) → macOS**.

> Bloqué plus de 15 minutes ? Va voir la section [Qui contacter](#9-qui-contacter).

### Combien de temps prévoir ?

Estimations pour une **première installation**, avec une connexion correcte (la plupart des étapes téléchargent quelque chose).

| Étape | Linux | Windows (WSL2) | macOS |
|---|---|---|---|
| §1 Prérequis : WSL2 / clone / Docker / Node.js | ~10 min | ~25 min (dont l'installation de WSL2 + 1 redémarrage) | ~10 min |
| §1.3 Python *(devs TCG / Worker OCR seulement)* | ~5 min | ~5 min | ~5 min |
| §2 Installer K3s | ~5 min | ~10 min (mise à jour d'Ubuntu incluse) | ~20 min (téléchargement de Rancher Desktop) |
| §3 Premier déploiement : Secrets, images, `deploy.sh`, migrations, seeds | ~25 min | ~25 min | ~25 min |
| **Total pour voir le site** | **~40 min** | **~1 h** | **~55 min** |
| §6 Préparer le mode code *(si tu codes)* | +10 min | +10 min | +10 min |

> Le plus long : la construction des images (§3.2) et le premier `deploy.sh`, qui télécharge PostgreSQL, Redis et nginx.
> Ensuite, au quotidien, la routine du §4 prend **2 minutes**.

---

## Vue d'ensemble

![Les 3 scripts : setup, deploy, dev](../docs/devops/schema/schema-scripts.svg)

- `setup-*.sh` : installe K3s, **une fois** par poste.
- `deploy.sh` : lance les services dans le cluster (complet ou `--light`).
- `dev.sh` : ouvre 2 tunnels vers les bases, **seulement pour coder**.

---

## Sommaire

1. [Prérequis](#1-prérequis)
2. [Installer K3s](#2-installer-k3s-une-seule-fois)
3. [Premier déploiement](#3-premier-déploiement-une-seule-fois)
4. [Routine au rallumage du poste](#4-routine-au-rallumage-du-poste)
5. [Voir le site dans le navigateur](#5-voir-le-site-dans-le-navigateur)
6. [Mode code (devs Front + Back)](#6-mode-code-devs-front--back)
7. [Comprendre Traefik en 2 minutes](#7-comprendre-traefik-en-2-minutes)
8. [Erreurs fréquentes](#8-erreurs-fréquentes)
9. [Qui contacter](#9-qui-contacter)
10. [TODO connus](#10-todo-connus)

---

## 1. Prérequis

### 1.1 Cloner le repo

- **Linux** : rien à préparer.
- **Windows** : installe d'abord WSL2 + Ubuntu. Dans PowerShell **en administrateur** : `wsl --install -d Ubuntu`, redémarre le PC,
  puis ouvre **Ubuntu** (il te demande un nom d'utilisateur et un mot de passe). **Ensuite, tout se passe dans le terminal Ubuntu**, jamais dans PowerShell.
- **macOS** : rien à préparer (`setup-macos.sh` installe Homebrew si besoin).

Puis, dans ton terminal :
```bash
cd ~
git clone https://github.com/Collectionr/collectionr_epitech.git collectionr
cd collectionr
```

> **Windows** : clone **dans Ubuntu** (`~`), jamais dans `/mnt/c/...` : les scripts y perdent leurs droits d'exécution (`Permission denied`) et tout est plus lent.

### 1.2 Outils

| Quoi | Pour qui | Comment vérifier |
|---|---|---|
| Git | Tout le monde | `git --version` |
| Docker | Tout le monde (build des images) | `docker --version` |
| Node.js **24** + npm | **Tout le monde** (migrations et seeds au §3) + devs JS/TS | `node -v` → `v24.x` (version exacte : `.nvmrc`) |
| Python **3.13** | Devs Python (microservice TCG, Worker OCR) | Voir [§1.3](#13-python-devs-tcg-et-worker-ocr) |
| 8 Go de RAM minimum | Tout le monde | 8 Go → utilise le mode `--light` |

⚠️ **Les scripts K3s n'installent ni Docker, ni Node.js, ni Python.** Installe Docker et Node.js dans tous les cas, Python seulement si tu codes en Python.

| OS | Docker | Node.js 24 |
|---|---|---|
| Linux / Windows (WSL2) | Docker Engine dans Ubuntu : `sudo apt install docker.io docker-buildx`, puis `sudo usermod -aG docker $USER` et **rouvre le terminal** (Docker Desktop avec l'intégration WSL marche aussi) | Avec [nvm](https://github.com/nvm-sh/nvm) : `nvm install` à la racine du repo (lit `.nvmrc`) |
| macOS | Fourni par Rancher Desktop (installé par `setup-macos.sh`) : moteur **dockerd (moby)** dans *Preferences → Container Engine* | `brew install node@24` ou nvm |

### 1.3 Python (devs TCG et Worker OCR)

Le microservice TCG exige **Python 3.13**. Ubuntu récent (WSL) ne propose que Python 3.14, et `python3 -m venv` y échoue sans le paquet `python3-venv`.
Le plus simple sur les 3 OS : **`uv`** (c'est l'outil qui génère les `requirements*.txt` du TCG). Depuis la racine du repo :

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh     # Linux, Windows (WSL2), macOS (puis rouvre le terminal)
uv python install 3.13
cd microservices/tcg
uv venv --python 3.13 .venv
source .venv/bin/activate
uv pip install -r requirements-dev.txt
uv pip install -e . --no-deps
```

Vérifie, toujours dans `microservices/tcg/` avec le `.venv` activé :
```bash
ruff check . && ruff format --check . && mypy && pytest --cov
```
✅ `All checks passed!`, `Success: no issues found`, puis les tests passent (couverture ≥ 50 %).

> **mypy** vérifie les types Python avant l'exécution (l'équivalent de `tsc` pour TypeScript). La CI le lance : lance-le avant ta PR.
> Toutes les commandes vérifiées par la CI, domaine par domaine : tableau « Lancer la CI en local avant la PR » de [`docs/CONTRIBUTING.md`](../docs/CONTRIBUTING.md).
> Détails de l'installation : [`microservices/tcg/README.md`](../microservices/tcg/README.md).

---

## 2. Installer K3s (une seule fois)

1. Place-toi à la racine du repo (cloné au §1.1) :
   ```bash
   cd ~/collectionr
   ```
2. Lance le script de **ton** OS :

| OS | Script |
|---|---|
| Linux | `./devops/scripts/setup-local.sh` |
| Windows (WSL2 / Ubuntu) | `./devops/scripts/setup-wsl2.sh` |
| macOS (Rancher Desktop / OrbStack) | `./devops/scripts/setup-macos.sh` |

3. **Windows uniquement** : si le script te dit qu'il a activé systemd :
   - ferme Ubuntu ;
   - dans PowerShell : `wsl --shutdown` ;
   - rouvre Ubuntu et relance le script.
4. Vérifie :
   ```bash
   kubectl get pods -A
   ```
   ✅ Tout est `Running` ou `Completed`.

> `Completed` = un job d'installation qui a fini son travail (ex. Helm pour Traefik). C'est normal.

### Tu as déjà d'autres clusters (k3d, un autre K3s…) ?

- **K3s déjà installé** : le script le réutilise, il ne le réinstalle pas.
- **k3d allumé** : arrête-le **avant** le script (`k3d cluster stop --all`), sinon Traefik ne peut pas prendre les ports 80/443.
- **Tes autres clusters disparaissent de `kubectl`** : le script sauvegarde ton `~/.kube/config` dans `~/.kube/config.backup.<date>`,
  puis le **remplace** par celui de K3s. Tes clusters existent toujours, seul leur accès a été retiré du fichier.
  Pour les récupérer **(Linux / Windows (WSL2))** :
  ```bash
  k3d kubeconfig merge --all --kubeconfig-merge-default     # tes clusters k3d
  kubectl config get-contexts
  ```
  ✅ `default` (CollectionR) **et** tes contextes `k3d-…` apparaissent. Pour un autre type de cluster, demande au DevOps (§9) :
  on fusionne la sauvegarde avec ton fichier actuel.
- **macOS** : Rancher Desktop ajoute son contexte `rancher-desktop` sans effacer les autres, rien à faire.

---

## 3. Premier déploiement (une seule fois)

⚠️ Les commandes `kubectl` de cette section ne vérifient pas le cluster visé (contrairement à `deploy.sh`).
Si tu as aussi k3d, vérifie d'abord : `kubectl config current-context` → Linux / Windows (WSL2) : `default` · macOS : `rancher-desktop`.

### 3.1 Créer les Secrets

Les mots de passe ne sont **jamais** dans Git. Tu les crées toi-même, une fois.

Sur un cluster neuf, crée d'abord le namespace qui va les contenir (sinon : `namespaces "development" not found`) :
```bash
kubectl apply -f devops/k3s/namespace.yaml
```
✅ `namespace/development created` (ou `unchanged` s'il existe déjà).

➡️ Puis suis la section **« Secrets à créer avant de déployer »** de [`devops/README.md`](./README.md).

⚠️ Ne modifie **jamais** le Secret PostgreSQL après le premier démarrage : la base garde l'ancien mot de passe.

### 3.2 Construire et importer les images

➡️ Sections **« Backend »** et **« Frontend »** de [`devops/README.md`](./README.md).

Exemple pour le Backend, sous Linux / Windows (WSL2) :
```bash
docker build -t collectionr-backend:dev backend/
docker save collectionr-backend:dev | sudo k3s ctr images import -
```

> macOS (Rancher Desktop, moteur dockerd) : **pas d'import**, l'image construite par `docker build` est directement visible par Kubernetes. À confirmer, voir [TODO connus](#10-todo-connus).

Quelle image pour quel mode ?
- `deploy.sh --light` → image **Backend** seulement.
- `deploy.sh` (complet) → images **Backend + Frontend** (sinon le Frontend reste en `ErrImagePull`).

⚠️ **Après chaque `git pull` de `dev` qui touche le Backend**, reconstruis l'image, réimporte-la, puis redémarre le Pod
(le tag `:dev` ne change pas, donc sans redémarrage le Pod garde l'ancienne image) :
```bash
kubectl rollout restart deployment/backend --namespace development
```

### 3.3 Lancer le cluster

Lance **une seule** des deux commandes :
```bash
./devops/scripts/deploy.sh           # complet (avec Frontend)
./devops/scripts/deploy.sh --light   # léger : PostgreSQL + Redis + Backend (postes 8 Go)
```

Autres options utiles :
- `--status` : affiche le mode actuel, sans rien relancer.
- `--help` : affiche l'aide.

✅ À la fin, le script teste `/health`. Il doit dire OK.

### 3.4 Appliquer les migrations Prisma

Sur un poste neuf, la base est vide.

➡️ Section **« Migrations Prisma »** de [`devops/README.md`](./README.md).

> Si `dev.sh` est déjà ouvert, son tunnel PostgreSQL suffit : saute le terminal 1 de la recette (sinon : `address already in use`).

### 3.5 Charger les données de test (seeds)

Fournies par le lead Back : rôles, catalogue (3 sets) et 10 comptes de démo avec une collection chacun.

Juste après les migrations (§3.4), **dans le même terminal** (`DATABASE_URL` encore définie, avant le `unset`) :
```bash
SEED_DEMO_DATA=true npm run prisma:seed
```
✅ `Demo data seeded (new rows only): 10 users, 10 collections, …`. Relançable sans risque : il n'ajoute que ce qui manque (2e lancement → `0 users`).

> `SEED_DEMO_DATA=true` force la création des comptes de démo, quelle que soit la valeur de `NODE_ENV`. Ne jamais l'utiliser sur une base qui contient de vraies données.

Comptes de démo :

| Email | Rôle | Mot de passe |
|---|---|---|
| `admin@collectionr.test` | ADMIN | `Test!1234` |
| `user1@collectionr.test` … `user9@collectionr.test` | USER | `Test!1234` |

---

## 4. Routine au rallumage du poste

À faire **à chaque fois** que tu rallumes ton PC.

1. Ouvre ton terminal :
   - **Linux** : ton terminal habituel ;
   - **Windows (WSL2)** : le terminal **Ubuntu**, pas PowerShell ;
   - **macOS** : l'app **Terminal** (ou iTerm2).
2. Vérifie que K3s tourne :
   - **Linux / Windows (WSL2)** :
     ```bash
     sudo systemctl status k3s
     ```
     ✅ `active (running)`. Sinon : `sudo systemctl start k3s`.
   - **macOS** : ouvre **Rancher Desktop** et attends que son icône (barre de menus) indique Kubernetes démarré.
3. Vérifie le cluster visé :
   ```bash
   kubectl config current-context
   ```
   ✅ Linux / Windows (WSL2) : `default` · macOS : `rancher-desktop`.
4. Vérifie les Pods :
   ```bash
   kubectl get pods -A
   ```
   ✅ Tout est `Running` ou `Completed`.
5. **Rouvre tes terminaux de travail** : ils ne reviennent pas tout seuls (pourquoi : [§6](#pourquoi-rouvrir-des-terminaux-à-chaque-session-)).
   - Tu codes → les terminaux du mode code (§6, « Au quotidien »).
   - **Windows** : tu veux voir le site → le tunnel Traefik (§5).

### Lire la colonne `RESTARTS`

| Ce que tu vois | Ça veut dire |
|---|---|
| `1 (2h ago)` après avoir rallumé ton PC | **Normal.** Le Pod a redémarré avec la machine. |
| Un nombre qui monte à chaque `get pods` | **Problème.** Le Pod plante en boucle → regarde ses logs. |

Voir les logs d'un Pod :
```bash
kubectl logs --namespace development <nom-du-pod>
```
(remplace `<nom-du-pod>` par le vrai nom, **sans** les `<` `>`)

### Tu as aussi un cluster k3d ?

**Jamais les deux allumés en même temps** : ils se battent pour les ports 80/443.

⚠️ Sous Linux / Windows (WSL2), **K3s redémarre tout seul à chaque allumage du PC**. Changer de contexte kubectl ne l'arrête pas :
avant d'utiliser k3d, arrête-le (`sudo systemctl stop k3s`). Si tu passes souvent de l'un à l'autre,
`sudo systemctl disable k3s` supprime le démarrage automatique (tu le lances alors toi-même avec `start`).

Revenir sur le cluster CollectionR — **Linux / Windows (WSL2)** :
```bash
k3d cluster stop <nom-du-cluster-k3d>
sudo systemctl start k3s
kubectl config use-context default
kubectl config current-context    # doit afficher : default
```

**macOS** : `k3d cluster stop <nom-du-cluster-k3d>`, ouvre Rancher Desktop, puis
`kubectl config use-context rancher-desktop` (doit afficher `rancher-desktop` avec `kubectl config current-context`).

> `deploy.sh` et `dev.sh` refusent de tourner sur un contexte `k3d-*`. C'est voulu.

---

## 5. Voir le site dans le navigateur

| Adresse | Ce que tu vois |
|---|---|
| `http://collectionr.localhost` | Le site (Frontend) |
| `http://collectionr.localhost/api/v1/...` | L'API (Backend) |
| `http://api.collectionr.localhost/health` | Santé du Backend |

### Linux

Ouvre directement `http://collectionr.localhost`.

### Windows (WSL2)

Le navigateur Windows ne voit pas directement le cluster WSL. Il faut un tunnel.

1. Dans un terminal Ubuntu (laisse-le ouvert) :
   ```bash
   kubectl port-forward --namespace kube-system svc/traefik 8081:80
   ```
2. Dans le navigateur Windows : `http://collectionr.localhost:8081`

> Sans tunnel → page blanche ou « site inaccessible ».

### macOS

Comme sous Linux : ouvre directement `http://collectionr.localhost`.

---

## 6. Mode code (devs Front + Back)

**Quand l'utiliser ?** Quand tu modifies le code et veux voir le résultat tout de suite.

**Le principe :**
- Front et Back tournent **sur ta machine** avec `npm` (rechargement automatique).
- PostgreSQL et Redis restent **dans le cluster**.
- `dev.sh` fait le pont entre les deux.

![Mode site et mode code](../docs/devops/schema/schema-modes.svg)

**Exemple :** tu modifies un bouton du Front.
- En mode site : rebuild de l'image + import + redéploiement (~5 min).
- En mode code : tu sauvegardes, la page se recharge (~1 s).

### Quel cas pour toi ? (combien de terminaux)

> **T1, T2, T3** = Terminal 1, Terminal 2, Terminal 3 : des fenêtres de terminal **ouvertes en même temps**.
> Chacune fait tourner un programme qui doit **rester allumé** (tunnel, Backend, Frontend).
> Sous Windows : une fenêtre Ubuntu (WSL) par terminal, ou un onglet par terminal dans Windows Terminal.

> ⚠️ Le **mode site** (`deploy.sh`) tourne **tout seul en fond** : aucun terminal à garder ouvert.
> Les terminaux ne servent qu'au **mode code**, et seulement pour ce que tu modifies.

### Pourquoi rouvrir des terminaux à chaque session ?

- **Le cluster revient tout seul.** K3s est un service : il redémarre avec ton PC (§4), et tout ce qui tourne **dans** le cluster (bases, Backend, Frontend) avec lui.
- **Les terminaux, non.** Un tunnel (`dev.sh`, `kubectl port-forward`) ou un serveur `npm run dev` / `npm run start:dev` est un programme lancé **dans ta fenêtre** :
  il vit tant qu'elle est ouverte. Fenêtre fermée ou PC éteint → il s'arrête, et rien ne le relance.
- **À quoi ils servent** : le tunnel relie ton code, qui tourne sur ta machine, aux bases restées dans le cluster (schéma « Mode code » ci-dessus).
  Sans lui, ton Backend local ne trouve ni PostgreSQL ni Redis (`/health` → `degraded`, `Can't reach database server`).
- **Pourquoi ne pas tout mettre dans le cluster ?** Il faudrait reconstruire et réimporter l'image à chaque modification (~5 min),
  au lieu d'un rechargement en ~1 s.

Chaque nouveau terminal s'ouvre dans ton dossier personnel : commence toujours par `cd ~/collectionr`.

| Je veux… | Je lance | Terminaux ouverts | `.env` à préparer ? |
|---|---|---|---|
| **Voir / démontrer l'appli** (DevOps, démo) | `deploy.sh` | Linux : 0 · Windows : 1 (tunnel Traefik, §5) · macOS : 0 | Non |
| **Modifier seulement le Front** | `deploy.sh --light`, puis T1 : `kubectl port-forward --namespace development svc/backend 3000:3000` · T2 : `cd frontend && npm run dev` | 2 | Non |
| **Modifier seulement le Back** | `deploy.sh --light`, puis T1 : `dev.sh` · T2 : `cd backend && npm run start:dev` | 2 | Oui |
| **Modifier le Front ET le Back** | `deploy.sh --light`, puis T1 : `dev.sh` · T2 : Backend · T3 : Frontend | 3 | Oui |

**Exemples :**
- Tu changes la couleur d'un bouton → « seulement le Front » : le Backend du cluster répond à ta place, sur le port 3000.
- Tu ajoutes une route d'API → « seulement le Back » : tu testes avec `curl` ou Swagger, sans lancer le Front.
- Tu branches un écran sur une nouvelle route → « Front ET Back ».

> « Seulement le Front » utilise l'image du Backend **déjà déployée** dans le cluster.
> Si le Back a changé sur `dev`, reconstruis l'image (§3.2) et relance `deploy.sh`.

### Quels mots de passe dans `.env` ?

| Variable | Valeur | Pourquoi |
|---|---|---|
| `DATABASE_URL` | **Même** mot de passe que le Secret | Une seule base : celle du cluster |
| `REDIS_URL` | **Même** mot de passe que le Secret | Un seul Redis : celui du cluster |
| `JWT_SECRET` | **Une clé à toi**, générée | C'est la clé du Backend local, pas d'une base |

> Les données sont partagées entre mode site et mode code (même base).
> Les sessions, non : change de mode → reconnecte-toi.

### Préparation (une seule fois par poste)

**Tu modifies seulement le Front** : depuis la racine du repo, `cd frontend && npm install`. C'est tout.

**Tu lances le Back sur ta machine** : étapes 1 à 5 ci-dessous.

1. Le cluster tourne (au moins `deploy.sh --light`).
2. Crée ton `.env` :
   ```bash
   cd backend
   cp .env.example .env
   ```
3. Remplis-le **sans que les mots de passe s'affichent dans le terminal** :
   > Dans le fichier `.env`, ils sont écrits **en clair** : c'est normal, le Backend doit pouvoir les lire.
   > Ce qui protège ce fichier : il reste sur ton PC et il est ignoré par Git.
   ```bash
   # PostgreSQL : même mot de passe que le Secret
   PG_USER=$(kubectl get secret postgresql-credentials --namespace development -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)
   PG_PWD=$(kubectl get secret postgresql-credentials --namespace development -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)
   PG_DB=$(kubectl get secret postgresql-credentials --namespace development -o jsonpath='{.data.POSTGRES_DB}' | base64 -d)
   sed -i "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${PG_USER}:${PG_PWD}@localhost:5432/${PG_DB}|" .env
   unset PG_USER PG_PWD PG_DB

   # Redis OCR : même mot de passe que le Secret
   REDIS_PWD=$(kubectl get secret redis-ocr-credentials --namespace development -o jsonpath='{.data.password}' | base64 -d)
   sed -i "s|^REDIS_URL=.*|REDIS_URL=redis://:${REDIS_PWD}@localhost:6379|" .env
   unset REDIS_PWD

   # JWT : une clé à toi (le Backend refuse la valeur d'exemple)
   sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
   ```
   > `sed` cherche la **ligne** qui commence par `NOM=` et la remplace en entier.
   > Tu n'as pas besoin de connaître l'ancienne valeur.
4. Vérifie (mots de passe masqués) :
   ```bash
   grep -E '^(DATABASE_URL|REDIS_URL|JWT_SECRET)=' .env | sed -E 's/:[^:@]*@/:***@/; s/(JWT_SECRET=).*/\1***/'
   grep -v '^#' .env | cut -d= -f1 | sort | uniq -d
   ```
   ✅ 3 lignes, avec des `***`. La 2e commande n'affiche **rien** (aucun doublon).
5. Installe les dépendances et génère le client Prisma (tu es toujours dans `backend/`) :
   ```bash
   npm install && npx prisma generate
   cd ../frontend && npm install     # seulement si tu lances aussi le Front
   cd ..
   ```
   > Relance `npx prisma generate` après chaque changement de `schema.prisma`.

⚠️ `.env` n'est **jamais** commité (il est dans `.gitignore`). Avant chaque commit : `git status` ne doit montrer aucun `.env`.

### Au quotidien (cas « Front ET Back » : 3 terminaux)

| Terminal | Commande | Résultat attendu |
|---|---|---|
| T1 | `./devops/scripts/dev.sh` | `Tunnels ouverts` (laisse ouvert) |
| T2 | `cd backend && npm run start:dev` | Log `Swagger documentation...` |
| T3 | `cd frontend && npm run dev` | `Local: http://localhost:5173/` |

Vérifier le Backend : `curl http://localhost:3000/health` → `status: ok`.
Navigateur : `http://localhost:5173`.

**Pour tout arrêter** : `Ctrl+C` dans chaque terminal.

> Pas besoin du tunnel Traefik dans ce mode.

---

## 7. Comprendre Traefik en 2 minutes

**Traefik = la porte d'entrée du cluster.**
Il lit l'adresse demandée et envoie la requête au bon service, selon des règles (les **Ingress**).

Exemple chez nous :
- `collectionr.localhost/api/...` → Backend
- `collectionr.localhost/...` → Frontend

### Test rapide avec nginx

```bash
# 1. Créer un petit serveur web de test
kubectl create deployment nginx-test --image=nginx
kubectl expose deployment nginx-test --port=80

# 2. Créer la règle : test.localhost -> nginx-test
kubectl create ingress nginx-test --rule="test.localhost/*=nginx-test:80"

# 3. Tester (attendre ~10 s que le Pod démarre)
curl -H "Host: test.localhost" http://localhost
# ✅ Tu dois voir "Welcome to nginx!"

# 4. Nettoyer
kubectl delete ingress,service,deployment nginx-test
```

---

## 8. Erreurs fréquentes

Classées dans l'ordre où tu risques de les croiser. La colonne **Voir** renvoie à la section qui explique l'étape concernée.

| Message | Cause | Fix | Voir |
|---|---|---|---|
| `Unable to connect to the server` / `connection … refused` (kubectl) | K3s arrêté | Linux / Windows : `sudo systemctl start k3s` · macOS : ouvre Rancher Desktop | §4 |
| `Failed to connect to system scope bus` | systemd pas activé dans WSL | Relance `setup-wsl2.sh`, puis `wsl --shutdown` | §2 |
| `error loading config file` (kubectl) | Chemin ou droits du kubeconfig | Relance le script d'installation. Vérifie `~/.kube/config` | §2 |
| `namespaces "development" not found` | Namespace pas encore créé | `kubectl apply -f devops/k3s/namespace.yaml` | §3.1 |
| `deploy.sh` : « Secrets manquants » | Secrets pas créés sur ce poste | Commandes de la section « Secrets » du README | §3.1 |
| `deploy.sh` refuse de tourner (contexte `k3d-*`) | Mauvais cluster visé | Arrête k3d, reviens sur K3s | §4 |
| `no context exists with the name: "k3d-…"` | Le script d'installation a remplacé ton kubeconfig | `k3d kubeconfig merge --all --kubeconfig-merge-default` | §2 |
| `ErrImagePull` / `ImagePullBackOff` | Image absente du cluster | Tag `:dev` (pas `:latest`) + import | §3.2 |
| `Successfully tagged` ou `naming to` à la fin du build | Deux versions de Docker, même résultat | Rien à faire, c'est OK | — |
| `permission denied while trying to connect to the Docker daemon socket` | Ton utilisateur n'est pas dans le groupe `docker` | `sudo usermod -aG docker $USER`, puis rouvre le terminal | §1.2 |
| `404` JSON `Cannot POST /api/v1/...` alors que `/health` répond | Image Backend plus ancienne que la route | Reconstruire + réimporter l'image, puis `kubectl rollout restart deployment/backend --namespace development` | §3.2 |
| `Cannot find module 'pino-pretty'` | `NODE_ENV` n'est pas `production` dans le conteneur | Vérifie `NODE_ENV=production` dans le manifest | DevOps |
| `Can't reach database server at localhost:5432` (Prisma) | Tunnel PostgreSQL fermé | Rouvre le tunnel (terminal 1 des migrations, ou `dev.sh`) | §3.4 · §6 |
| `address already in use` (port-forward) | Un autre tunnel utilise déjà ce port | Ferme l'autre terminal (un seul tunnel par port) | §6 |
| `dev.sh` : « Un tunnel n'a pas démarré » | Port 5432 ou 6379 déjà pris | Arrête ton PostgreSQL/Redis local ou l'autre `dev.sh` | §6 |
| `/health` → `degraded` | Une dépendance (souvent Redis) ne répond pas | Vérifier `dev.sh` (T1) et `REDIS_URL` | §6 |
| `NOAUTH Authentication required` | Mauvais mot de passe dans `REDIS_URL` | Recopier depuis le Secret | §6 étape 3 |
| `JWT_SECRET looks like a placeholder` | Valeur d'exemple de `.env.example` | Générer une clé | §6 étape 3 |
| `has no exported member 'User'` (ou autre modèle) | Client Prisma pas généré sur ce poste | `cd backend && npx prisma generate` | §6 étape 5 |
| `vite: not found` (code 127) | Dépendances du Front pas installées | `cd frontend && npm install` | §6 Préparation |
| Page blanche dans le navigateur Windows | Pas de tunnel Traefik | Ouvre le tunnel (terminal à laisser ouvert) | §5 |
| `python3.13: command not found` | Python 3.13 absent (Ubuntu récent : 3.14 seulement) | Installer avec `uv` | §1.3 |
| `ensurepip is not available` | Paquet `python3-venv` absent | Créer le venv avec `uv venv` | §1.3 |
| `Permission denied` sur un script `.sh` | Droits manquants, souvent repo cloné dans `/mnt/c` (Windows) | Recloner dans `~`, ou `chmod 755 devops/scripts/<script>.sh` | §1.1 |
| `unknown flag: --n` | Tiret mal copié (souvent depuis un PDF ou Word) | Écris `--namespace` en entier, sur une seule ligne | — |
| `syntax error near unexpected token newline` | Un `<...>` d'exemple tapé tel quel | Remplace `<...>` par la vraie valeur, sans `<` `>` | — |
| `kubectl get pods -w` affiche plusieurs lignes pour un Pod | Normal : une ligne par changement d'état | Rien à faire | — |

> Tu tombes sur une erreur absente de ce tableau ? Une fois résolue, **ajoute-la ici** dans une PR.

---

## 9. Qui contacter

| Sujet | Contact |
|---|---|
| Installation K3s, déploiement, scripts | Lead DevOps / Cloud |
| CI GitHub Actions | Collègue Cloud |
| Seeds, `.env` Backend, Prisma | Lead Back |
| Frontend, Vite | Lead Front |

Sur Discord, donne toujours :
1. ton OS ;
2. la commande lancée ;
3. le message d'erreur **complet** (copié-collé, pas en photo).

---

## 10. TODO connus

- [ ] **Équipe IA (Beta)** : ajouter le Worker OCR à `--light` dès que son Dockerfile est livré (prévu début décembre). En attendant, pour tester avec le Back sur ton PC : même dossier local dans `OCR_SHARED_DIR` pour le Backend **et** le Worker (ex. `/tmp/collectionr-ocr`).
- [ ] **Équipe TCG (Beta)** : ajouter un tunnel Redis TCG à `dev.sh` quand le Microservice/Workers TCG seront déployés.
- [ ] **macOS** : vérifier sur le poste Mac que, avec Rancher Desktop en moteur **dockerd (moby)**, l'image construite par `docker build` est bien visible par Kubernetes sans import (§3.2), et que `http://collectionr.localhost` répond.
