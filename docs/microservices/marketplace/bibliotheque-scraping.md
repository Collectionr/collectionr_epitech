# Étude des bibliothèques de collecte (Python)

## Objectif

Cette section identifie, compare et sélectionne les bibliothèques **Python** adaptées au **Worker TCG**.

Le projet privilégie les **APIs ouvertes** (TCGdex, pokemontcg.io), qui fournissent déjà les prix
agrégés. Le **scraping HTML** n'est utilisé qu'en **dernier recours encadré**, et les **flux RSS**
servent uniquement à une éventuelle rubrique « actualités » (pas aux prix — voir
[decision-technique.md](decision-technique.md)).

> Le worker est en **Python**, découplé du backend NestJS, et écrit dans PostgreSQL.

---

## Typologie des besoins

| Besoin | Approche recommandée |
|--------|----------------------|
| Interroger une API REST/JSON (TCGdex, pokemontcg.io, eBay Browse) | Client HTTP (`httpx`) |
| Parser une page HTML statique (rendu serveur) | Client HTTP + parseur (`selectolax` / `BeautifulSoup`) |
| Page rendue en JavaScript | Navigateur headless (`Playwright`) — dernier recours |
| Cible protégée par fingerprint TLS | `curl_cffi` (impersonation) — usage ciblé |
| Flux RSS (actualités) | `feedparser` |

---

## Bibliothèques principales (Python / usage projet)

> Classées de la **plus** à la **moins** recommandable pour le Worker TCG.

### 1. httpx — client HTTP recommandé ✅

- **Usage** : interroger les APIs ouvertes et officielles (JSON).
- **Avantages** : API **sync et async**, **HTTP/2**, timeouts/retries, moderne.
- **Inconvénients** : signature TLS d'OpenSSL détectable (inadapté seul aux sites anti-bot).
- **Cas d'usage** : TCGdex, pokemontcg.io, eBay Browse API.

### 2. selectolax — parseur HTML rapide ✅

- **Usage** : parsing HTML à débit élevé (backend `lexbor`).
- **Avantages** : 5 à 30× plus rapide que BeautifulSoup, sélecteurs CSS.
- **Inconvénients** : moins tolérant au HTML mal formé.

### 3. BeautifulSoup4 — parseur HTML tolérant (repli) ✅

- **Usage** : parser du HTML « sale » ou prototypage.
- **Avantages** : très tolérant, simple.
- **Inconvénients** : le plus lent. Utilisé en **complément** de selectolax.

### 4. curl_cffi — impersonation TLS (anti-bot ciblé)

- **Usage** : endpoints protégés par fingerprint TLS/HTTP2, sans lancer de navigateur.
- **Avantages** : imite les empreintes Chrome/Safari ; léger.
- **Inconvénients** : **n'exécute pas le JavaScript** → ne franchit pas les défis JS / Turnstile.

### 5. Playwright — navigateur headless (dernier recours)

- **Usage** : pages rendues en JavaScript.
- **Avantages** : support JS complet, multi-navigateurs, async, **plus moderne et stable que
  Selenium**.
- **Inconvénients** : lourd (CPU/mémoire). Le module `playwright-stealth` est **fragile** et peu
  maintenu en 2026 ; pour une cible réellement protégée, préférer **nodriver**.

### 6. feedparser — flux RSS / Atom (actualités uniquement)

- **Usage** : consommer des flux RSS éditoriaux (sorties de sets, articles).
- **Avantages** : référence Python, maintenu (v6.0.x).
- **Inconvénients** : **aucun flux RSS de prix exploitable n'existe** en 2026 — à ne pas utiliser
  pour la collecte de prix.

### 7. requests — déconseillé pour du neuf ⚠️

- **Usage** : scripts ponctuels synchrones.
- **Inconvénients** : **« feature freeze » perpétuel** (correctifs de sécurité uniquement), pas
  d'async ni HTTP/2. **Remplacé par `httpx`.**

### 8. Scrapy — framework (non retenu) ❌

- **Usage** : scraping à grande échelle.
- **Avantages** : performant, structuré (pipelines).
- **Inconvénients** : **surdimensionné** pour une approche API-first à faible volumétrie. **Non
  retenu** pour ce projet.

---

## Outils transverses du worker

| Rôle | Outil |
|------|-------|
| Retry / back-off (HTTP 429) | `tenacity` |
| Limitation de débit (politesse) | `aiolimiter` |
| Validation / typage des données | `pydantic` |
| Accès PostgreSQL (UPSERT) | `psycopg 3` |

---

## Comparatif global

| Bibliothèque    | Type                     | HTTP | HTML | JS  | Anti-détection | Async | Statut projet |
|-----------------|--------------------------|------|------|-----|----------------|-------|---------------|
| httpx           | Client HTTP              | ✔️   | ❌   | ❌  | ❌             | ✔️    | **Retenu (défaut)** |
| selectolax      | Parseur HTML             | ❌   | ✔️   | ❌  | ❌             | ❌    | **Retenu (défaut)** |
| BeautifulSoup4  | Parseur HTML             | ❌   | ✔️   | ❌  | ❌             | ❌    | **Retenu (repli)** |
| curl_cffi       | Client HTTP (TLS)        | ✔️   | ❌   | ❌  | ✔️ (TLS only)  | ✔️    | Recours ciblé |
| Playwright      | Navigateur               | ✔️   | ✔️   | ✔️  | Partiel¹       | ✔️    | Dernier recours |
| nodriver        | Navigateur furtif        | ✔️   | ✔️   | ✔️  | ✔️             | ✔️    | Recours (cibles dures) |
| feedparser      | Lecteur RSS/Atom         | ✔️   | ❌   | ❌  | ❌             | ❌    | Actualités only |
| requests        | Client HTTP              | ✔️   | ❌   | ❌  | ❌             | ❌    | Déconseillé (gelé) |
| Scrapy          | Framework                | ✔️   | ✔️   | ❌  | ❌             | ✔️    | Non retenu |

> ¹ Playwright « vanilla » est facilement détecté par Cloudflare ; `playwright-stealth` est peu
> fiable en 2026. Pour les cibles dures, **nodriver** donne les meilleurs résultats open-source.

---

## État de l'anti-bot en 2026 (à connaître)

Le scraping des marketplaces se heurte à des protections avancées :

- Le **fingerprinting TLS/HTTP2 (JA3/JA4)** est le principal vecteur de détection.
- **`curl_cffi`** passe la détection TLS (~26/31 cibles d'un benchmark public) **mais pas les défis
  JavaScript / Turnstile**.
- **`nodriver`** (auteur d'`undetected-chromedriver`) est le meilleur outil open-source (~28/31).
- Les **proxies résidentiels** sont quasi obligatoires (réputation IP datacenter négative).
- Conséquence : le scraping des cibles protégées (Cardmarket, TCGPlayer) est **coûteux, fragile et
  juridiquement risqué** — et inutile puisque leurs prix sont déjà servis par TCGdex / pokemontcg.io.

---

## Recommandation pour le projet

### Bibliothèques Python retenues

- **APIs ouvertes / officielles** → `httpx` (+ `tenacity`, `aiolimiter`)
- **Parsing HTML (scraping ponctuel)** → `selectolax`, `BeautifulSoup4` en repli
- **Cible TLS-gated (rare)** → `curl_cffi`
- **Cible à défi JS (très rare)** → `nodriver` (+ proxies résidentiels)
- **Actualités (optionnel)** → `feedparser`
- **Normalisation / DB** → `pydantic`, `psycopg 3`

### Stratégie

1. **APIs ouvertes (TCGdex, pokemontcg.io)** pour les prix et métadonnées.
2. **eBay Browse API** pour les annonces actives (optionnel).
3. **Scraping HTML** isolé derrière un *kill-switch*, à faible volume, jamais sur Cardmarket /
   TCGPlayer.

---

## Conclusion

Le besoin réel de CollectionR (afficher prix et métadonnées) se résout **par API ouverte**, sans
scraper. Les bibliothèques de scraping (`selectolax`, `curl_cffi`, `nodriver`) restent documentées
comme **capacité de dernier recours**, encadrée par des garde-fous techniques et juridiques.

> Synthèse : **APIs d'abord** (`httpx`) ; scraping rare et isolé ; RSS pour les actualités, pas pour
> les prix.

---

## Sources

Vérifications web (juin 2026) — versions, maintenance, anti-bot :

- [httpx](https://www.python-httpx.org/) · [requests — « feature freeze »](https://requests.readthedocs.io/en/latest/dev/contributing/) · [Playwright Python — release notes](https://playwright.dev/python/docs/release-notes) · [selectolax](https://github.com/rushter/selectolax) · [BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/) · [feedparser](https://feedparser.readthedocs.io/) · [curl_cffi](https://github.com/lexiforest/curl_cffi)
- **Benchmark anti-détection 2026** (curl_cffi, nodriver, Playwright stealth) : [ianlpaterson.com — anti-detect browser benchmark](https://ianlpaterson.com/blog/anti-detect-browser-benchmark-patchright-nodriver-curl-cffi/)
