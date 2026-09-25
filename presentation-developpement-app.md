# CollectionR — Comment nous développons l'application

> **But de ce document** : brief de contenu destiné à Claude Desktop pour mettre en page une présentation.
> Il couvre **toutes les parties du projet** : Frontend, Backend & Base de données, Microservices, IA, Cloud, DevOps, Sécurité.
> Chaque section = un thème (≈ une slide ou un groupe de slides) et explique **les principes** + **ce qu'ils comprennent**.
> Source : documentation du repo (`docs/`). À reformuler / illustrer librement pour les slides.

---

## 0. Contexte du produit

- **CollectionR** : application **multi-plateforme** (web + mobile) de **gestion de collection de cartes** (TCG, ex. Pokémon).
- Fonctionnalités clés : parcourir/rechercher des cartes, gérer sa collection, suivre les prix du marché, **scanner une carte** par photo (reconnaissance IA), pré-grader son état.
- Projet d'équipe organisé en **7 domaines** : Frontend, Backend & Données, Microservices, IA, Cloud, DevOps, Sécurité.
- Objet de la présentation : **la méthode de développement** — principes, architecture, conventions et outils, domaine par domaine.

---

## 1. Vue d'ensemble technique

**Une plateforme conteneurisée, orchestrée par K3s, autour d'une base PostgreSQL unique.**

| Couche | Technologies |
|---|---|
| Frontend | React + Vite (web), Expo / React Native (mobile), Tailwind / NativeWind |
| Backend | NestJS + Fastify (TypeScript), Prisma, Clean Architecture |
| Données | PostgreSQL (source unique de vérité), Redis (files de tâches) |
| Microservices | Workers Python découplés (TCG, OCR, Grading) via files Redis |
| IA | Pipeline OCR 2 niveaux (YOLO+OCR → VLM), servi par Triton |
| Cloud / Runtime | K3s (local → prod), Docker, Traefik, observabilité Prometheus/Grafana/Loki |
| DevOps | GitHub Actions (CI/CD), 3 environnements isolés |
| Sécurité | Security by Design, Zero Trust, RGPD |

**3 modes de communication** : synchrone (REST), asynchrone (files Redis), temps réel (SSE pour le suivi des jobs).

**Message slide** : « Des services découplés, une base de vérité unique, un socle K3s portable du laptop à la prod. »

---

## 2. Frontend

### Architecture — un monorepo, deux apps, une logique partagée
- **Monorepo** (workspaces npm) : `apps/web` (React + Vite + Tailwind), `apps/mobile` (Expo / RN + NativeWind), `packages/shared` (logique pure : hooks, stores, services API, types, validation, tokens — **jamais de JSX**).
- **Découpage par dossier, pas par fichier** : plus de suffixes `.web.tsx`/`.native.tsx`.
- **Décisions structurantes** : pas de composants UI partagés (wireframes desktop/mobile divergents) ; cohérence assurée par les **design tokens partagés** ; **une seule version de React/RN** ; alias `@shared/*` vs `@/*`.

### Le principe Atomic Design — et ce qu'il comprend

| Niveau | Rôle | Droits | Exemples |
|---|---|---|---|
| **Atom** | Élément de base indivisible | Aucune logique métier | `Button`, `PriceTag` |
| **Molecule** | Groupe fonctionnel d'atomes | Reçoit des props, ne récupère rien | `CardPreview`, `SearchBar` |
| **Organism** | Section complète | Hooks de présentation (tri/filtre), pas d'appel API | `CardList`, `CollectionGrid` |
| **Template** | Mise en page sans données | Disposition, enfants via props/slots | `CollectionLayout` |
| **Page** | Écran connecté | **Seul** à utiliser TanStack Query + Zustand, orchestre | `CollectionPage` |

→ **Flux** : la `Page` récupère la donnée et la fait descendre en props ; le rendu remonte de l'atome à la page.

### Design System — une seule source de vérité visuelle
Aucune valeur magique : tout passe par un **token**. Couleurs sémantiques, police **Inter** (échelle `text-xs`→`text-3xl`), espacements en **multiples de 4px**, radius/ombres par usage. Mode sombre prévu en phase 2 (via tokens).

### Conventions de code & anti-patterns
- **TypeScript strict**, `any` interdit ; nommage normalisé ; imports ordonnés via alias + barrels ; JSDoc obligatoire ; jamais de `catch` silencieux ni `console.log`.
- **Anti-patterns interdits** : fetch dans un composant, `useEffect` pour le data fetching, état serveur dans Zustand, index comme `key`, styles en dur, props drilling > 2 niveaux.

### Données & État — le bon outil pour la bonne donnée

| Donnée | Outil |
|---|---|
| Locale à un composant | `useState` |
| Serveur (cartes, prix, collection) | **TanStack Query** (cache, dedup, loading/error) |
| Globale UI (modal, filtre) | **Zustand** |
| Session / auth | **Zustand** persisté |

**Règle d'or** : ne jamais dupliquer le state serveur dans Zustand.

**Message slide** : « Toute la logique partagée, le rendu propre à chaque plateforme ; de l'atome à la page, la donnée descend. »

---

## 3. Backend & Base de données

### Stack technique
- **API principale** : NestJS · TypeScript (`strict: true`) · Fastify (adaptateur HTTP) · Prisma (ORM) · PostgreSQL.
- **Pipeline de données** : Python (asynchrone) pour ingestion, nettoyage, normalisation et entraînement des modèles IA.
- **Pont de données** : PostgreSQL, base relationnelle partagée entre le pipeline Python (écriture des données de référence) et l'API TypeScript (exposition client).

### Clean Architecture — 4 couches concentriques

| Couche | Rôle |
|---|---|
| Entités (Domaine) | Modélisation TCG + règles métier, sans dépendance externe |
| Cas d'utilisation (Application) | Orchestration via Use Cases, consomme des interfaces (ports) |
| Adaptateurs d'interface (Présentation) | Contrôleurs HTTP Fastify, formatage des réponses/DTO |
| Frameworks & Pilotes (Infrastructure) | Config Fastify, Prisma/PostgreSQL, appels aux microservices IA |

- Organisation **modulaire par domaine** (`modules/cards`, `users`, `collections` + `shared/`).
- **Inversion de dépendance** (ex. `CardRepository` → `PrismaCardRepository`). Couverture de tests cible **> 70 %**.
- Conventions : `any` interdit, `interface` pour les structures / `type` pour unions, Use Cases nommés `<Action><Entité>UseCase`, logique métier dans les services jamais dans les contrôleurs.

### Modèle de données (PostgreSQL, ids UUID)
- **Catalogue** : `LICENCE_TCG → SET → CARD → VARIANT` (+ estimation de prix sur `CARD`).
- **Utilisateurs & accès** : `USER`, `ROLE`, `PERMISSION`, `SESSION`, `CONSENT`.
- **Collections** : `COLLECTION`, `COLLECTIONITEM`, `COLLECTIONVALUEHISTORY`.
- **Prix** : `DATASOURCE`, `CARDPRICE`, `PRICEHISTORY`, `SCRAPELOG`.
- **Scan & grading** : `SCANHISTORY`, `GRADINGRESULT` (centrage, coins, bords, surface).
- Règle transversale : `cardId` toujours obligatoire, `variantId` optionnel.

**Message slide** : « Une API NestJS/TypeScript en Clean Architecture modulaire + un pipeline Python IA, réunis autour d'une base PostgreSQL centralisée. »

---

## 4. Microservices

### Principe directeur
- Backend **NestJS (Fastify)** expose l'API et lit/écrit dans **PostgreSQL = source unique de vérité**.
- **Pipelines d'arrière-plan** orchestrés via files **Redis** dans un cluster **K3s** ; workers **Python** découplés, sans API REST exposée.

| Pipeline | Rôle | Statut |
|---|---|---|
| Microservice TCG | Synchronise cartes (métadonnées) + collecte/prédit les prix | V1 |
| Pipeline OCR | Reconnaît une carte depuis une photo (suivi SSE) | V1 |
| Grading IA | Pré-gradation état/centrage par vision IA | Bonus V1 |

### Microservice TCG — orchestrateur FastAPI + 3 workers (Redis Streams)
- **TCG API** : métadonnées + prix agrégés (TCGdex, niveau 1).
- **TCG Scraping** : PokeTrace (niv. 2) puis eBay Browse API (niv. 3) puis TCGFast Trader (niv. 4) — **aucun scraping**.
- **TCG Prediction** : estimation IA sur l'historique de prix.
- Écriture PostgreSQL via `psycopg 3` (UPSERT idempotents). La **langue** fait partie de l'identité d'un prix (`cardId, source, condition, language`).

### API interne vs externe
- **API CollectionR** (interne) : lecture seule en base, endpoints `GET /cards/:id`, `/cards/search`, `/market/:id` ; ne déclenche jamais de collecte à la demande.
- **API externe TCGdex** : fournisseur principal (REST/GraphQL, MIT, sans clé) de métadonnées + prix agrégés, caché localement.

### Stratégie « zéro scraping »
Cascade **TCGdex → PokeTrace → eBay Browse → TCGFast** + cache PostgreSQL (filet permanent) ; Cardmarket/TCGPlayer/eBay directs écartés (CGU + Cloudflare). Stack Python : `httpx`, `selectolax`/`BeautifulSoup4`, `pydantic`, `tenacity` + `aiolimiter`.

**Message slide** : « Backend NestJS sur PostgreSQL + workers Python découplés (TCG, OCR, Grading) ; prix et cartes via une cascade 100 % API officielle, sans scraping. »

---

## 5. Intelligence Artificielle (reconnaissance de cartes)

### Pipeline OCR / reconnaissance
- Objectif : extraire des champs structurés d'une image de carte (nom, HP, types, attaques, numéro, édition, rareté) en **JSON**.
- Architecture cible **2 niveaux** : Niveau 1 **YOLOv10 + PaddleOCR** (flux standard) ; Niveau 2 **VLM** (Florence-2 ou Qwen2.5-VL) seulement sur les cartes ambiguës.
- Modèle retenu exporté (HuggingFace ou ONNX) et exposé via un backend **FastAPI** (`/health`, `/predict`).

### Serveur d'inférence Triton
- Triton (NVIDIA) héberge le(s) modèle(s) séparément du backend (HTTP/gRPC).
- Avantages : requêtes concurrentes, meilleure utilisation GPU, mise à jour du modèle sans redémarrer le backend.

### Évaluation du modèle — seuils de validation
| Critère | Seuil |
|---|---|
| Exact Match (nom, HP, n°) | ≥ 0.80 |
| Field Coverage | ≥ 0.90 |
| JSON Validity | ≥ 0.95 |
| Hallucination | ≤ 0.05 |
| Latence médiane | ≤ 3000 ms |

Batch (scan collection) : throughput ≥ 2 cartes/s, P95 ≤ 5000 ms.

### FinOps (coûts) — le GPU pèse plus que le modèle
| Modèle | GPU | Coût/mois |
|---|---|---|
| YOLOv10+PaddleOCR (MVP) | T4 | ~307 $ |
| Qwen2.5-VL (qualité) | L4 | ~491 $ |
| DeepSeek-VL2 (à éviter) | A100 80 Go | ~3 441 $ |

**Roadmap IA** : datasets → benchmark des modèles → validation/fine-tuning → implémentation Docker & tests bout en bout.

**Message slide** : « Reconnaissance via un pipeline OCR 2 niveaux (YOLO+OCR puis VLM), servi par Triton, validé par des seuils stricts et un choix GPU optimisé coût. »

---

## 6. Cloud & Architecture runtime

### Principes cloud
- **Cloud-agnostic / portabilité** : Docker + manifests Kubernetes standards, déployable AWS/GCP/Azure sans ressource propriétaire.
- **Infrastructure as Code** : manifests versionnés dans Git (Terraform pour le serveur).
- **Cohérence des environnements** (mêmes manifests du local à la prod), **FinOps** (Free Tier, alertes), **anti vendor lock-in**, **sécurité native** (chiffrement, secrets, RGPD).

### Choix technologiques
- **K3s** = orchestrateur principal (Kubernetes léger). **Docker** = build d'images multi-arch. **Traefik** = Ingress HTTPS unique.
- Stack : React/RN, NestJS, Python (IA), PostgreSQL + Redis, Vault/Doppler (secrets), GitHub Actions.

| Étape | Solution | Coût | Cible |
|---|---|---|---|
| Dev | K3s local | 0 € | Itérations |
| Bêta | K3s + VPS (Hetzner/Scaleway) | 20-40 €/mois | ~1 000 users |
| Prod | K8s managé (Scaleway, OVHcloud) | 40 €+/mois | > 10 000 users |

### Architecture runtime
- Cluster K3s en **namespaces isolés** (dev/staging/prod) : secrets distincts, RBAC, NetworkPolicies.
- **Deployments** stateless (front, back, microservice TCG, workers) ; **StatefulSets** pour Redis et PostgreSQL.
- **Résilience** : recréation auto des Pods, liveness/readiness probes, limites CPU/RAM. Stockage : PVC PostgreSQL (sauvegardes CronJob), volume OCR temporaire (purge < 24 h).
- **Observabilité** : Prometheus + Grafana + Loki + Promtail.

**Message slide** : « K3s comme socle unique et portable, du local au cloud managé, pour des services résilients communiquant via REST, files Redis et SSE, à coût maîtrisé. »

---

## 7. DevOps

### Stratégie d'environnements (dev / staging / prod)
Trois environnements progressifs partageant les **mêmes manifests Kubernetes** (seules les valeurs changent).

| Env | Infra | Données | Statut |
|---|---|---|---|
| Développement | K3s local | Fictives | Actif |
| Staging | K3s sur VPS | Proches du réel | Prévu 2026-2027 |
| Production | K8s managé / multi-nœuds | Réelles | À terme |

- **Lancement local en une commande**, multi-OS (Linux, WSL2, macOS), profil `--light` pour postes 8 Go.
- **Isolation stricte** : NetworkPolicies, secrets par env (→ Vault en prod), feature flags, observabilité.

### Pipeline CI/CD (GitHub Actions) — fail fast
- **CI à chaque PR** : Gitleaks → Lint (ESLint/Prettier/Ruff) → Build Docker multi-arch → Tests unitaires (Jest/Pytest/RTL) → Intégration → Infra K3s (k3d) → OWASP ZAP → Coverage (Back 70 %, Python 50 %, Front 40 %).
- **CD après merge** : `develop` → staging, `main` → production (`kubectl apply`), notif Discord. Branches protégées, **rollback** via `kubectl rollout undo`.

**Message slide** : « Trois environnements K3s isolés + une CI/CD GitHub Actions fail-fast qui teste, sécurise et déploie automatiquement chaque modification. »

---

## 8. Sécurité & Conformité

### Principes fondamentaux
**Security by Design** + **défense en profondeur**, 4 piliers : **moindre privilège**, **Zero Trust** (tout accès authentifié/autorisé/tracé), **séparation des environnements**, **sécurité K3s** (NetworkPolicies, Secrets, RBAC, pas de conteneur privilégié).

### Threat model (méthode STRIDE)
Identifie les actifs critiques (comptes, tokens, collections, secrets, volume OCR) puis les menaces (techniques STRIDE, abus métier, menaces sur les flux), chacune associée à une mitigation.

### Sécurité des API
| Domaine | Mesures |
|---|---|
| Auth | JWT (access 15 min / refresh 7 j), rotation + révocation, mots de passe bcrypt/Argon2 |
| Autorisation | RBAC, contrôle d'ownership anti-IDOR côté serveur |
| OWASP Top 10 | Injection, XSS, CSRF, headers (CSP, HSTS…) |
| Anti-abus | Rate limiting `/login`, `/register`, `/scan` ; sécurité volume OCR |

### Conformité RGPD
- Bases légales (contrat, obligation légale, consentement) ; **minimisation** (images OCR purgées après traitement).
- Droits utilisateurs (accès, rectification, oubli, portabilité), suppression en cascade ≤ 30 j.
- Data breach : notification CNIL < 72 h ; hébergement UE certifié ISO 27001.

### Logs & audit
Logs structurés JSON sans données sensibles (stack **Loki + Grafana + Promtail**), accès RBAC. Conservation : applicatifs/infra 30 j, audit 90 j.

**Message slide** : « Security by Design de bout en bout : Zero Trust, threat model STRIDE, API durcies, conformité RGPD native. »

---

## 9. Workflow d'équipe & qualité (transverse)

- **Branches** : `COLLR-<NUM-TICKET>/<type>/<description>` (un ticket = une branche, jamais de push direct sur `main`/`develop`).
- **Commits** : Conventional Commits `type(scope): description`.
- **Pull Requests** : review obligatoire (**« deux yeux minimum »**), squash merge, suppression après merge.
- **Stratégie de tests (pyramide)** : beaucoup d'unitaires → intégration → peu d'E2E (parcours critiques). Couverture cible par stack : Back 70 %, Python 50 %, Front 40 % (≥ 70 % sur les hooks/utils front).
- **Definition of Done** propre à chaque domaine (front : responsive, skeleton, typage strict, 4 états gérés, tokens respectés).

**Message slide** : « Un process Git rigoureux et une qualité outillée, partagés par toutes les équipes. »

---

## 10. Évolutivité & roadmap

- **Frontend** : migration vers Feature-Sliced Design si croissance ; mode sombre (phase 2, via tokens).
- **Infra** : staging puis production réelle visés **2026-2027** ; passage K8s managé au-delà de ~10 000 utilisateurs.
- **IA** : du MVP (YOLO+OCR) vers VLM de qualité selon budget ; fine-tuning si seuils non atteints.
- **Documentation vivante** centralisée (`docs/`) comme référence d'équipe.

**Message slide** : « Une fondation simple et portable aujourd'hui, pensée pour scaler demain. »

---

## Plan de présentation suggéré (ordre des slides)

1. Contexte produit (CollectionR : web + mobile, scan de cartes)
2. Vue d'ensemble technique (la carte des 7 domaines + le socle K3s/PostgreSQL)
3. **Frontend** : monorepo + **Atomic Design** (les 5 niveaux) + design tokens
4. Frontend : conventions, anti-patterns, data/état (TanStack Query vs Zustand)
5. **Backend & Données** : Clean Architecture + modèle PostgreSQL
6. **Microservices** : workers découplés + cascade « zéro scraping »
7. **IA** : pipeline OCR 2 niveaux, Triton, seuils de qualité, FinOps
8. **Cloud & Runtime** : K3s portable, résilience, observabilité
9. **DevOps** : 3 environnements + CI/CD fail-fast
10. **Sécurité & RGPD** : Zero Trust, STRIDE, API durcies
11. Workflow d'équipe & qualité (Git, PR, tests)
12. Évolutivité & roadmap

> Ton conseillé : pédagogique, orienté **« décisions et pourquoi »**. Pour chaque domaine, 1 schéma + 1 exemple concret (ex. `PriceTag` = atom ; cascade TCGdex → eBay → TCGFast ; pipeline OCR YOLO → VLM).
> ⚠️ À vérifier avant de présenter : palette de couleurs front (« à confirmer une fois la maquette finie » dans la doc) et dates staging/prod (2026-2027).
