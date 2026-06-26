# Étude des bibliothèques de collecte (Python)

## Objectif

Cette section identifie, compare et sélectionne les bibliothèques **Python** adaptées au **Worker TCG**.

Le projet applique une **cascade de 3 sources API** : **TCGdex** (niveau 1, gratuit, sans clé) →
**eBay Browse API** (niveau 2, complément officiel) → **TCGFast Trader** (niveau 3, fallback payant
14,99 $/mois), avec **cache PostgreSQL** comme filet de sécurité permanent. Les **flux RSS** servent
uniquement à une éventuelle rubrique « actualités / sorties de sets » (pas aux prix — voir
[decision-technique.md](decision-technique.md)).

> Le worker est en **Python**, découplé du backend NestJS, et écrit dans PostgreSQL.

---

## Typologie des besoins

| Besoin | Approche recommandée |
|--------|----------------------|
| Interroger une API REST/JSON (TCGdex, eBay Browse, TCGFast) | Client HTTP (`httpx`) |
| Parser une réponse API en format HTML ou XML | Parseur (`selectolax` / `BeautifulSoup4`) |
| Flux RSS (actualités sets uniquement) | `feedparser` |
| Retry / back-off (HTTP 429, erreurs transitoires) | `tenacity` |
| Limitation de débit | `aiolimiter` |

---

## Bibliothèques principales (Python / usage projet)

### 1. httpx — client HTTP recommandé ✅

- **Usage** : interroger les APIs ouvertes et officielles (TCGdex, eBay Browse, TCGFast).
- **Avantages** : API **sync et async**, **HTTP/2**, timeouts/retries configurables, moderne.
- **Inconvénients** : signature TLS d'OpenSSL identifiable (sans impact pour des APIs officielles).
- **Cas d'usage projet** : tous les appels aux 3 sources de la cascade.

### 2. selectolax — parseur HTML/XML rapide ✅

- **Usage** : parsing de réponses API ou flux dont le format serait HTML/XML structuré.
- **Avantages** : 5 à 30× plus rapide que BeautifulSoup4, sélecteurs CSS.
- **Inconvénients** : moins tolérant au balisage mal formé.
- **Cas d'usage projet** : parsing de réponses structurées si une source retourne du HTML/XML.

### 3. BeautifulSoup4 — parseur HTML tolérant (repli) ✅

- **Usage** : parser du balisage « sale » ou prototypage.
- **Avantages** : très tolérant, simple d'utilisation.
- **Inconvénients** : le plus lent des parseurs HTML. Utilisé en repli de selectolax.

### 4. feedparser — flux RSS / Atom (actualités uniquement) ✅

- **Usage** : consommer des flux RSS éditoriaux (sorties de sets, articles).
- **Avantages** : référence Python, maintenu (v6.0.x).
- **Cas d'usage projet** : rubrique actualités uniquement — **jamais pour les prix**.

### 5. requests — déconseillé pour du neuf ⚠️

- **Inconvénients** : **« feature freeze » perpétuel** (correctifs de sécurité uniquement), pas
  d'async ni HTTP/2. **Remplacé par `httpx`** pour tout nouveau code.

### 6. Scrapy — framework (non retenu) ❌

- **Inconvénients** : **surdimensionné** pour une approche API-first. Impose son architecture
  (spiders, reactor) là où `httpx` suffit.

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

| Bibliothèque   | Type             | HTTP | Parse | Async | Statut projet |
|----------------|------------------|------|-------|-------|---------------|
| httpx          | Client HTTP      | ✔️   | ❌    | ✔️    | **Retenu (défaut)** |
| selectolax     | Parseur HTML/XML | ❌   | ✔️    | ❌    | **Retenu (défaut)** |
| BeautifulSoup4 | Parseur HTML     | ❌   | ✔️    | ❌    | **Retenu (repli)** |
| feedparser     | Lecteur RSS/Atom | ✔️   | ❌    | ❌    | Actualités only |
| requests       | Client HTTP      | ✔️   | ❌    | ❌    | Déconseillé (gelé) |
| Scrapy         | Framework        | ✔️   | ✔️    | ✔️    | Non retenu |

---

## Recommandation pour le projet

### Bibliothèques Python retenues

- **Appels API (TCGdex, eBay Browse, TCGFast)** → `httpx` (+ `tenacity`, `aiolimiter`)
- **Parsing de réponses structurées** → `selectolax`, `BeautifulSoup4` en repli
- **Actualités / sorties de sets (optionnel)** → `feedparser`
- **Normalisation / DB** → `pydantic`, `psycopg 3`

### Stratégie (cascade officielle)

1. **TCGdex** — source principale, gratuite, sans clé, licence MIT pour les métadonnées ; prix
   Cardmarket (EUR) et TCGPlayer (USD) agrégés avec historique avg1/avg7/avg30.
2. **eBay Browse API** — complément officiel, annonces actives uniquement, OAuth gratuit.
3. **TCGFast Trader** (`https://tcgfast.com`) — fallback payant (14,99 $/mois) si niveaux 1 et 2
   indisponibles ; prix eBay réels + PSA/BGS/CGC + historique ; SDK Python ; usage commercial OK.
4. **Cache PostgreSQL** — filet de sécurité permanent si les 3 sources sont indisponibles ;
   dernières valeurs connues servies avec horodatage, aucune erreur bloquante.

---

## Conclusion

Le besoin réel de CollectionR (afficher prix et métadonnées) se résout **intégralement par API**,
sans scraping. `httpx` est l'outil central pour les 3 niveaux de la cascade ; `selectolax` et
`BeautifulSoup4` restent disponibles pour le parsing de réponses structurées si nécessaire.

> Synthèse : **cascade API** (TCGdex → eBay Browse → TCGFast) via `httpx` + cache PostgreSQL ;
> `feedparser` pour les actualités ; aucun outil de scraping ou de bypass anti-bot nécessaire.

---

## Sources

Vérifications web (juin 2026) — versions et maintenance :

- [httpx](https://www.python-httpx.org/) · [requests — « feature freeze »](https://requests.readthedocs.io/en/latest/dev/contributing/) · [selectolax](https://github.com/rushter/selectolax) · [BeautifulSoup](https://www.crummy.com/software/BeautifulSoup/) · [feedparser](https://feedparser.readthedocs.io/)
- **TCGFast** : [https://tcgfast.com](https://tcgfast.com)
