# Décision technique — Stratégie de collecte des données TCG

## Contexte

Le microservice TCG de CollectionR doit collecter deux types de données :

1. les **métadonnées** des cartes Pokémon (nom, set, rareté, image, attaques…) ;
2. les **prix de marché** de ces cartes.

Historiquement, on supposait pouvoir s'appuyer sur les **APIs officielles** des marketplaces
(Cardmarket, eBay, TCGPlayer). Une vérification menée en **juin 2026** montre que cette hypothèse
n'est plus tenable : ces accès sont **fermés ou restreints**.

---

## Constat 2026 : accès aux sources de données

| Source | État de l'accès (juin 2026) | Conséquence |
|--------|------------------------------|-------------|
| **TCGPlayer** (API) | **Fermée aux nouveaux développeurs** depuis fin 2024 (rachat eBay) | Inutilisable pour un nouveau projet |
| **eBay** (Finding API) | **Décommissionnée** le 05/02/2025 | Remplacée par Browse API |
| **eBay** (Browse API) | OAuth, programme développeur ouvert, clé gratuite | **Annonces actives uniquement** — complément officiel |
| **Cardmarket** (API) | Réservée aux **vendeurs professionnels** (approbation manuelle) ; CGU interdisent de présenter prix/cartes sur un service tiers sans accord écrit | Inadaptée à l'usage CollectionR |
| **TCGdex** | **Ouverte, gratuite, sans clé, licence MIT** ; métadonnées + prix agrégés Cardmarket (EUR) + TCGPlayer (USD) avec historique avg1/avg7/avg30 | **Source principale — niveau 1** |
| **PokeTrace** | API dédiée TCG (`poketrace.com`) ; prix EUR (Cardmarket) + USD (TCGPlayer/eBay) avec ventilation par état (NM, LP…) et grade (PSA/BGS/CGC) ; freemium 250 req/jour, plan Pro 10 000/jour | **Fallback EUR — niveau 2** |
| **TCGFast Trader** | API dédiée TCG (`tcgfast.com`), 14,99 $/mois ; prix TCGPlayer + eBay + gradués PSA/BGS/CGC + historique ; SDK Python ; usage commercial autorisé | **Fallback payant — niveau 4** |
| **pokemontcg.io** | Migré vers Scrydex, devenu payant | **Écarté** : supprimé |
| **Scrydex** | Payant, modèle crédits | **Écarté** : coût disproportionné |

> **Conséquence directe :** la stratégie s'appuie sur une **cascade de 3 sources API** avec
> **cache PostgreSQL** comme filet de sécurité permanent.

---

## Décision

### Approche retenue : **cascade API 3 niveaux + cache permanent**

| Niveau | Source | Condition d'activation |
|--------|--------|------------------------|
| **1 — Principal** | **TCGdex** (`https://api.tcgdex.net`) | Toujours interrogé en premier |
| **2 — Fallback EUR** | **PokeTrace** (`https://poketrace.com`) | Si TCGdex est indisponible — maintien des prix EUR Cardmarket |
| **3 — Complément USD** | **eBay Browse API** (programme dev eBay) | Si TCGdex et PokeTrace indisponibles |
| **4 — Fallback payant** | **TCGFast Trader** (`https://tcgfast.com`) | Si niveaux 1, 2 et 3 simultanément indisponibles |
| **Filet permanent** | **Cache PostgreSQL** | Si les 4 sources sont indisponibles : dernières valeurs connues servies avec horodatage |

#### Niveau 1 — TCGdex

- Gratuit, sans clé, **licence MIT** pour les métadonnées.
- Catalogue **français (FR) et anglais (EN)** dès la V1 ; japonais hors périmètre V1.
- Fournit prix Cardmarket (EUR) et TCGPlayer (USD) agrégés avec historique `avg1` / `avg7` / `avg30`.
- **Recommandation officielle TCGdex** : mettre les données en cache PostgreSQL localement plutôt que d'appeler l'API en boucle — CollectionR respecte ce principe.

#### Niveau 2 — PokeTrace (fallback EUR)

- Freemium : **250 requêtes/jour** gratuites ; plan Pro **10 000 requêtes/jour**.
- Prix **EUR Cardmarket + USD TCGPlayer/eBay** avec **ventilation par état** (NM, LP, MP…) et
  **grade** (PSA/BGS/CGC) — données plus granulaires que TCGdex sur ce point.
- **Premier fallback activé** si TCGdex est indisponible, notamment pour maintenir les prix EUR.
- Clé stockée dans les **Secrets Kubernetes** (`POKETRACE_API_KEY`).

#### Niveau 3 — eBay Browse API

- API officielle, programme développeur eBay, clé OAuth gratuite.
- **Annonces actives uniquement** (pas de ventes terminées), prix USD.
- Ne jamais scraper eBay hors de cette API officielle (CGU 2026 interdisent les bots).

#### Niveau 4 — TCGFast Trader (fallback payant)

- Plan Trader à **14,99 $/mois** — usage commercial autorisé.
- Données complémentaires : prix eBay (ventes réelles), **prix gradués PSA / BGS / CGC**, historique.
- SDK Python disponible. Clé stockée dans les **Secrets Kubernetes** (`TCGFAST_API_KEY`).
- Activé uniquement si les niveaux 1, 2 et 3 sont simultanément indisponibles.

#### Filet de sécurité — cache PostgreSQL

À chaque écriture des workers, les prix sont **horodatés** en base. Si les trois sources sont
indisponibles, le backend sert les **dernières valeurs connues** avec un message informatif et
l'horodatage de la dernière mise à jour. **Aucune erreur bloquante pour l'utilisateur.**

---

## Justification

### Fiabilité

- Les APIs structurées fournissent des **données normalisées** et un champ de fraîcheur (`updated`).
- Le cache PostgreSQL garantit la **continuité de service** en cas d'indisponibilité externe.

### Légalité et conformité

- **TCGdex** : licence MIT pour les métadonnées ; prix agrégés (Cardmarket/TCGPlayer) soumis aux
  CGU de ces sources en amont.
- **PokeTrace** : freemium — vérifier les CGU commerciales avant passage GO.
- **eBay Browse API** : usage conforme au programme développeur officiel.
- **TCGFast** : usage commercial explicitement autorisé par les CGU du plan Trader.
- **Scraping absent** : Cardmarket et TCGPlayer sont protégés par **Cloudflare Enterprise** en 2026
  (fingerprinting TLS/HTTP2, Turnstile, challenges JS). Contourner ces protections viole les CGU
  de ces sites — et est inutile puisque leurs prix sont déjà disponibles légalement via TCGdex.

### Performance et maintenabilité

- Stack réduite à l'essentiel : **httpx** pour les appels API, **pydantic** pour la validation,
  **psycopg 3** pour l'écriture, **tenacity / aiolimiter** pour la résilience.
- Pas de navigateur headless, pas d'outil anti-bot à maintenir.

---

## Langage du worker : **Python**

Les workers (`Worker TCG API`, `Worker TCG Fallback`, `Worker TCG Prediction`) sont écrits en
**Python**, pour :

- s'aligner sur le **« Pipeline de Données » Python** décrit dans
  [clean-architecture.md](../../backend/clean-architecture.md) ;
- mutualiser le code de normalisation et les modèles d'IA de prédiction de prix ;
- bénéficier de l'écosystème d'intégration API le plus mature.

Le backend applicatif reste **NestJS (sur adaptateur Fastify), TypeScript** ; les workers Python
sont des composants **découplés** qui écrivent dans PostgreSQL.

---

## Choix des outils (Python)

| Besoin | Outil retenu | Remarque |
|--------|--------------|----------|
| Appels API REST/JSON | **httpx** | sync + async, HTTP/2 ; remplace `requests` (gelé) |
| Flux RSS (actualités sets) | **feedparser** | jamais pour les prix |
| Validation / normalisation | **pydantic** | devise, état, langue |
| Accès PostgreSQL | **psycopg 3** | UPSERT idempotents |
| Retry / back-off | **tenacity** | HTTP 429, erreurs transitoires |
| Limitation de débit | **aiolimiter** | politesse envers les APIs tierces |

**Sources de prix retenues (cascade) :**

| Niveau | Source | URL | Conditions |
|--------|--------|-----|------------|
| 1 — Principal | **TCGdex** | `https://api.tcgdex.net` | Gratuit, sans clé, MIT (métadonnées) ; FR + EN |
| 2 — Fallback EUR | **PokeTrace** | `https://poketrace.com` | Freemium 250 req/j, Pro 10 000 req/j |
| 3 — Complément USD | **eBay Browse API** | Programme dev eBay | OAuth gratuit, annonces actives USD |
| 4 — Fallback payant | **TCGFast Trader** | `https://tcgfast.com` | 14,99 $/mois, commercial OK, SDK Python |
| Filet | **Cache PostgreSQL** | — | Dernières valeurs connues + horodatage |

Voir le détail dans [bibliotheque-scraping.md](bibliotheque-scraping.md).

---

## Outils non retenus

### `requests`
- En **« feature freeze » perpétuel** (correctifs de sécurité uniquement), pas d'async ni HTTP/2.
- Remplacé par **httpx**.

### Scrapy
- Surdimensionné pour une approche API-first.
- Impose son architecture là où `httpx` suffit.

### Playwright / nodriver / curl_cffi (pour scraping marketplace)
- Scraping des marketplaces (Cardmarket, TCGPlayer, eBay hors Browse API) interdit par CGU et
  inefficace contre Cloudflare Enterprise en 2026.
- Ces outils sont **hors périmètre** : les données sont disponibles via TCGdex et TCGFast.

---

## Conclusion

La stratégie retenue permet de :

- **maximiser la fiabilité** (cascade 3 sources API + cache PostgreSQL permanent) ;
- **rester conforme** (aucun scraping de marketplace) ;
- **limiter la dette technique** (stack réduite : httpx + pydantic + psycopg 3).

> TCGdex couvre l'essentiel du besoin (FR + EN). PokeTrace assure le premier fallback avec les prix
> EUR Cardmarket et la granularité par état/grade. eBay Browse enrichit avec les annonces actives USD.
> TCGFast couvre le fallback final et les besoins PSA/BGS/CGC. Le cache PostgreSQL garantit la
> continuité de service en toutes circonstances.

---

## Sources

Vérifications web (juin 2026) :

- **TCGdex** : [FAQ](https://tcgdex.dev/faq) · [Markets & Prices](https://tcgdex.dev/markets-prices) · [licence MIT](https://github.com/tcgdex/cards-database)
- **PokeTrace** : [https://poketrace.com](https://poketrace.com)
- **eBay** : [dépréciation Finding API (Q3 2024)](https://developer.ebay.com/updates/newsletter/q3_2024) · [Browse API](https://developer.ebay.com/api-docs/buy/browse/overview.html) · [User Agreement 2026](https://www.valueaddedresource.net/ebay-bans-ai-agents-updates-arbitration-user-agreement-feb-2026/)
- **TCGFast** : [https://tcgfast.com](https://tcgfast.com)
- **Cardmarket** : [API (réservée vendeurs pro)](https://help.cardmarket.com/en/cardmarket-api) · [CGU](https://www.cardmarket.com/en/Policies/GeneralTermsAndConditions)
- **TCGPlayer** : [API fermée aux nouveaux dev](https://docs.tcgplayer.com/docs/getting-started) · [Terms](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions)
- **Outils Python** : voir [bibliotheque-scraping.md](bibliotheque-scraping.md).
