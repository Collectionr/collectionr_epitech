# Onboarding — Environnement local CollectionR

Objectif : être opérationnel **en moins d'1 heure**, quel que soit ton OS.

Ce guide te dit **quoi faire et dans quel ordre**.
Les détails techniques sont dans [`devops/README.md`](./README.md) : on y renvoie quand il le faut.

> Bloqué plus de 15 minutes ? Va voir la section [Qui contacter](#9-qui-contacter).

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

| Quoi | Pour qui | Comment vérifier |
|---|---|---|
| Git | Tout le monde | `git --version` |
| Docker | Tout le monde (build des images) | `docker --version` |
| Node.js + npm | Devs JS/TS (Front, Back) | `node -v` et `npm -v` |
| 8 Go de RAM minimum | Tout le monde | 8 Go → utilise le mode `--light` |

⚠️ **Node.js n'est pas installé par les scripts K3s.** Installe-le à part si tu codes en JS/TS.

**Windows** : tout se passe **dans le terminal Ubuntu (WSL2)**, pas dans PowerShell.

---

## 2. Installer K3s (une seule fois)

1. Clone le repo et place-toi à la racine :
   ```bash
   git clone <url-du-repo> collectionr
   cd collectionr
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

---

## 3. Premier déploiement (une seule fois)

### 3.1 Créer les Secrets

Les mots de passe ne sont **jamais** dans Git. Tu les crées toi-même, une fois.

➡️ Suis la section **« Secrets à créer avant de déployer »** de [`devops/README.md`](./README.md).

⚠️ Ne modifie **jamais** le Secret PostgreSQL après le premier démarrage : la base garde l'ancien mot de passe.

### 3.2 Construire et importer les images

➡️ Sections **« Backend »** et **« Frontend »** de [`devops/README.md`](./README.md).

Exemple pour le Backend (Linux / WSL2) :
```bash
docker build -t collectionr-backend:dev backend/
docker save collectionr-backend:dev | sudo k3s ctr images import -
```

> macOS : la commande d'import est différente. Voir [TODO connus](#10-todo-connus).

### 3.3 Lancer le cluster

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

### 3.5 Charger les données de test (seeds)

Fournies par le lead Back : 5 sets de cartes + utilisateurs fictifs avec collections.

➡️ *Commande à venir (TODO, vers le 13/11).*

---

## 4. Routine au rallumage du poste

À faire **à chaque fois** que tu rallumes ton PC.

1. Ouvre ton terminal (Ubuntu sous Windows).
2. Vérifie que K3s tourne :
   ```bash
   sudo systemctl status k3s
   ```
   ✅ `active (running)`. Sinon : `sudo systemctl start k3s`.
3. Vérifie le cluster visé :
   ```bash
   kubectl config current-context
   ```
   ✅ `default`.
4. Vérifie les Pods :
   ```bash
   kubectl get pods -A
   ```
   ✅ Tout est `Running` ou `Completed`.

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

```bash
k3d cluster stop <nom-du-cluster-k3d>
sudo systemctl start k3s
kubectl config use-context default
kubectl config current-context    # doit afficher : default
```

> `deploy.sh` et `dev.sh` refusent de tourner sur un contexte `k3d-*`. C'est voulu.

---

## 5. Voir le site dans le navigateur

| Adresse | Ce que tu vois |
|---|---|
| `http://collectionr.localhost` | Le site (Frontend) |
| `http://collectionr.localhost/api/v1/...` | L'API (Backend) |
| `http://api.collectionr.localhost/health` | Santé du Backend |

### Linux / macOS

Ouvre directement `http://collectionr.localhost`.

### Windows (WSL2)

Le navigateur Windows ne voit pas directement le cluster WSL. Il faut un tunnel.

1. Dans un terminal Ubuntu (laisse-le ouvert) :
   ```bash
   kubectl port-forward --namespace kube-system svc/traefik 8081:80
   ```
2. Dans le navigateur Windows : `http://collectionr.localhost:8081`

> Sans tunnel → page blanche ou « site inaccessible ».

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

| Je veux… | Je lance | Terminaux ouverts | `.env` à préparer ? |
|---|---|---|---|
| **Voir / démontrer l'appli** (DevOps, démo) | `deploy.sh` | 0 (Linux/macOS) · 1 sous Windows : tunnel Traefik (§5) | Non |
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

### Préparation (une seule fois par poste — si tu lances le Back sur ta machine)

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
5. Installe les dépendances et génère le client Prisma :
   ```bash
   cd backend && npm install && npx prisma generate
   cd ../frontend && npm install
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

| Message | Cause | Fix |
|---|---|---|
| `Failed to connect to system scope bus` | systemd pas activé dans WSL | Relance `setup-wsl2.sh`, puis `wsl --shutdown` |
| `error loading config file` (kubectl) | Chemin ou droits du kubeconfig | Relance le script d'installation. Vérifie `~/.kube/config` |
| `unknown flag: --n` | Tiret mal copié (souvent depuis un PDF ou Word) | Écris `--namespace` en entier, sur une seule ligne |
| `syntax error near unexpected token newline` | Un `<...>` d'exemple tapé tel quel | Remplace `<...>` par la vraie valeur, sans `<` `>` |
| `kubectl get pods -w` affiche plusieurs lignes pour un Pod | Normal : une ligne par changement d'état | Rien à faire |
| `Cannot find module 'pino-pretty'` | `NODE_ENV` n'est pas `production` dans le conteneur | Vérifie `NODE_ENV=production` dans le manifest |
| `ErrImagePull` / `ImagePullBackOff` | Image absente du cluster | Tag `:dev` (pas `:latest`) + import (§3.2) |
| Page blanche dans le navigateur Windows | Pas de tunnel Traefik | Voir §5 Windows |
| `Successfully tagged` ou `naming to` à la fin du build | Deux versions de Docker, même résultat | Rien à faire, c'est OK |
| `has no exported member 'User'` (ou autre modèle) | Client Prisma pas généré sur ce poste | `cd backend && npx prisma generate` |
| `JWT_SECRET looks like a placeholder` | Valeur d'exemple de `.env.example` | Générer une clé (§6, étape 3) |
| `NOAUTH Authentication required` | Mauvais mot de passe dans `REDIS_URL` | Recopier depuis le Secret (§6, étape 3) |
| `/health` → `degraded` | Une dépendance (souvent Redis) ne répond pas | Vérifier `dev.sh` (T1) et `REDIS_URL` |
| `vite: not found` (code 127) | Dépendances du Front pas installées | `cd frontend && npm install` |
| `Permission denied` sur un script `.sh` | Droits manquants (lecture ou exécution) | `chmod 755 devops/scripts/<script>.sh` |
| `dev.sh` : « Un tunnel n'a pas démarré » | Port 5432 ou 6379 déjà pris | Arrête ton PostgreSQL/Redis local ou l'autre `dev.sh` |
| `deploy.sh` refuse de tourner (contexte `k3d-*`) | Mauvais cluster visé | Voir §4 « Tu as aussi un cluster k3d ? » |

> Tu tombes sur une erreur absente de ce tableau ? Une fois résolue, **ajoute-la ici** dans une PR.

---

## 9. Qui contacter

| Sujet | Contact |
|---|---|
| Installation K3s, déploiement, scripts | Lead Tech / Cloud |
| CI GitHub Actions | Collègue Cloud |
| Seeds, `.env` Backend, Prisma | Lead Back |
| Frontend, Vite | Lead Front |

Sur Discord, donne toujours :
1. ton OS ;
2. la commande lancée ;
3. le message d'erreur **complet** (copié-collé, pas en photo).

---

## 10. TODO connus

- [ ] **Seeds** : commande à ajouter au §3.5 (lead Back, vers le 13/11).
- [ ] **Équipe IA (Beta)** : ajouter le Worker OCR à `--light` dès que son Dockerfile est livré (prévu début décembre). En attendant, pour tester avec le Back sur ton PC : même dossier local dans `OCR_SHARED_DIR` pour le Backend **et** le Worker (ex. `/tmp/collectionr-ocr`).
- [ ] **Équipe TCG (Beta)** : ajouter un tunnel Redis TCG à `dev.sh` quand le Microservice/Workers TCG seront déployés.
- [ ] **macOS** : vérifier l'import d'image avec Rancher Desktop / OrbStack (les images Docker y sont peut-être visibles directement).
