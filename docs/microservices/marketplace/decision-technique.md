# Décision technique — Stratégie de collecte des données TCG

## Contexte

Le microservice TCG de CollectionR doit collecter deux types de données :

1. les **métadonnées** des cartes Pokémon (nom, set, rareté, image, attaques…) ;
2. les **prix de marché** de ces cartes.

Historiquement, on supposait pouvoir s'appuyer sur les **APIs officielles** des marketplaces
(Cardmarket, eBay, TCGPlayer). Une vérification menée en **juin 2026** montre que cette hypothèse
n'est plus tenable : ces accès sont **fermés ou restreints**.

---

## Constat 2026 : accès aux marketplaces

| Source | État de l'accès (juin 2026) | Conséquence |
|--------|------------------------------|-------------|
| **TCGPlayer** (API) | **Fermée aux nouveaux développeurs** depuis fin 2024 (rachat eBay) | Inutilisable pour un nouveau projet |
| **eBay** (API) | Finding API **décommissionnée** (05/02/2025) ; ventes terminées via *Marketplace Insights* en accès restreint ; Browse API = **annonces actives** seulement | Limité aux annonces actives |
| **Cardmarket** (API) | Réservée aux **vendeurs professionnels** (approbation manuelle) ; **CGU interdisent** de présenter prix/cartes sur un service tiers sans accord écrit | Inadaptée à l'usage CollectionR |
| **TCGdex** | **Ouverte, gratuite, sans clé** ; expose métadonnées **et** prix agrégés (Cardmarket + TCGPlayer) | **Source à privilégier** |

> **Conséquence directe :** la stratégie ne peut pas reposer sur un accès direct aux APIs
> marketplace. Elle s'appuie sur des **APIs ouvertes qui agrègent déjà ces prix**.

---

## Décision

### Approche retenue : **stratégie multi-méthode, API ouverte d'abord**

Par ordre de priorité :

1. **APIs ouvertes (source principale)** — TCGdex et pokemontcg.io fournissent gratuitement les
   prix agrégés Cardmarket (EUR) et TCGPlayer (USD), sans clé ou avec une clé gratuite, sans
   scraping.
2. **eBay Browse API (complément optionnel)** — pour les **annonces actives** uniquement, dans le
   cadre du programme développeur.
3. **Scraping HTML (dernier recours, encadré)** — uniquement si une donnée est introuvable
   autrement, à faible volume, et **jamais sur Cardmarket ni TCGPlayer** (verrou juridique).
4. **Flux RSS** — **aucun flux RSS de prix gratuit n'existe** (vérifié juin 2026, voir l'encadré
   ci-dessous). Le RSS est réservé à une éventuelle rubrique « actualités / sorties de sets ».

> **Flux RSS de prix : inexistant (recherche poussée, juin 2026).** Aucune source ne fournit de
> flux RSS gratuit et légal de prix de cartes Pokémon :
> - **eBay** a supprimé ses flux RSS de recherche (`?_rss=1`, cassés vers avril 2022, abandonnés
>   depuis ~janvier 2023) ; même actifs, ils ne donnaient que les **annonces actives**, jamais les
>   ventes terminées.
> - **TCGPlayer** n'expose qu'un RSS **éditorial** (articles, decks), pas de prix.
> - **Cardmarket**, **PriceCharting** et les trackers (PokemonPriceTracker, pkmn.gg…) n'offrent que
>   des **API**, aucun flux RSS de prix.
> - Les générateurs RSS tiers (rss.app, rssbay…) ne font que **scraper** eBay — interdit par son
>   User Agreement (en vigueur 20/02/2026) et juridiquement risqué (pas de licence implicite,
>   *MidlevelU v. ACI*, 11e Circuit 2021).
>
> **Conclusion : la piste RSS pour les prix est abandonnée — les prix passent par API.**

---

## Justification

### Fiabilité

- Les APIs ouvertes fournissent des **données structurées** et un champ de fraîcheur (`updated`).
- Le scraping HTML est **fragile** (dépend du DOM), sensible aux changements front et aux
  protections anti-bot (Cloudflare, Akamai).

### Légalité et conformité

- TCGdex / pokemontcg.io : usage encadré par leurs CGU (free tier **non-commercial** ; palier payant
  pour le commercial).
- **Métadonnées vs prix** : la licence **MIT de TCGdex couvre les métadonnées**, **pas les prix**
  qu'il relaie (régis par les CGU **Cardmarket / TCGPlayer en amont**). Affichage des prix à des
  tiers : restreint (Cardmarket exige un accord écrit). Détail des CGU et de « ce qu'on peut faire »
  dans [marketplace-scraper.md](marketplace-scraper.md) (§11).
- Scraper Cardmarket ou TCGPlayer **viole leurs CGU** ; eBay interdit aussi le scraping (robots.txt
  `Disallow`, user agreement 2026 interdisant les bots). Voir la section **Garde-fous légaux**.

### Performance et maintenabilité

- API → faible coût de maintenance, rapide.
- Scraping (surtout avec rendu JavaScript) → lent, coûteux en ressources, maintenance élevée.

### Inutilité du scraping direct des marketplaces

> Les prix Cardmarket et TCGPlayer sont **déjà disponibles légalement via TCGdex / pokemontcg.io**.
> Scraper directement ces sites est donc non seulement risqué mais **largement inutile**.

---

## Langage du worker : **Python**

Le worker de collecte (`Worker TCG API` et `Worker TCG Scraping`) est écrit en **Python**, pour :

- s'aligner sur le **« Pipeline de Données » Python** décrit dans
  [clean-architecture.md](../../backend/clean-architecture.md) (ingestion, normalisation, IA) ;
- mutualiser le code de normalisation et les modèles d'IA de prédiction de prix ;
- bénéficier de l'écosystème scraping / anti-bot le plus mature.

Le backend applicatif reste **NestJS (sur adaptateur Fastify), TypeScript** ; le worker Python est
un composant **découplé** qui écrit dans PostgreSQL.

---

## Choix des outils (Python)

| Besoin | Outil retenu | Remarque |
|--------|--------------|----------|
| Client HTTP | **httpx** | sync + async, HTTP/2 ; remplace `requests` (gelé) |
| Parsing HTML | **selectolax** (+ BeautifulSoup4 en repli) | rapide ; bs4 pour le HTML mal formé |
| Flux RSS (actualités) | **feedparser** | pas pour les prix |
| Validation / normalisation | **pydantic** | devise, état, langue |
| Accès PostgreSQL | **psycopg 3** | UPSERT idempotents |
| Anti-bot (dernier recours) | **curl_cffi**, sinon **nodriver** + proxies | usage ciblé et encadré |

Voir le détail comparatif dans [bibliotheque-scraping.md](bibliotheque-scraping.md).

---

## Outils non retenus

### `requests`
- En **« feature freeze » perpétuel** (correctifs de sécurité uniquement), pas d'async ni HTTP/2.
- Remplacé par **httpx** pour tout nouveau code.

### Scrapy
- Surdimensionné pour une approche API-first à faible volumétrie.
- Impose son architecture (spiders, reactor) là où `httpx` + `selectolax` suffisent.

### Selenium
- Plus lourd et moins moderne que Playwright (qui reste, lui, un **dernier recours** pour le JS).

### `playwright-stealth`
- Maintenance irrégulière et anti-détection limitée en 2026. Si un navigateur furtif est
  réellement nécessaire, préférer **nodriver**.

---

## Conclusion

La stratégie retenue permet de :

- **maximiser la fiabilité** (APIs ouvertes agrégeant déjà les prix) ;
- **rester conforme** (pas de scraping des marketplaces verrouillées) ;
- **limiter la dette technique** (stack Python cohérente, scraping isolé derrière un *kill-switch*).

> Le scraping HTML est un **mécanisme de dernier recours encadré**, pas une source principale de
> données. Les APIs ouvertes (TCGdex, pokemontcg.io) couvrent l'essentiel du besoin.
