# Intégration de l'API TCGdex

## Vue d'ensemble

Le projet CollectionR s'appuie sur l'**API TCGdex** comme fournisseur externe principal de
**métadonnées de cartes** du JCC Pokémon, et comme **source de prix** agrégés.

TCGdex est une **API REST (et GraphQL) open-source** qui fournit des données structurées pour les
cartes du Jeu de Cartes à Collectionner Pokémon : détails des cartes, sets, séries, images, et —
depuis 2025 — un champ de **prix agrégés** (Cardmarket et TCGPlayer).

Elle est utilisée pendant le développement comme **base de cartes de référence**, synchronisée
vers la **base de données interne CollectionR (PostgreSQL)** par le `Worker TCG API`.

> **Pourquoi TCGdex plutôt qu'un accès direct aux marketplaces ?**
> En 2026, les APIs des marketplaces sont fermées ou restreintes : l'API TCGPlayer n'accepte plus
> de nouveaux développeurs, l'API Cardmarket est réservée aux vendeurs professionnels, et la
> Finding API d'eBay est décommissionnée. TCGdex agrège légalement métadonnées **et** prix de ces
> sources en un seul point d'accès gratuit. Voir [decision-technique.md](../marketplace/decision-technique.md).

---

## Fonctionnalités principales

L'API fournit :

- Métadonnées des cartes Pokémon (nom, HP, types, attaques, capacités, rareté)
- Sets et séries de cartes
- Images des cartes (CDN dédié)
- **Prix agrégés** : Cardmarket (EUR) et TCGPlayer (USD), avec historiques 1 / 7 / 30 jours
- Support multilingue
- Endpoints REST et GraphQL, SDK officiels (dont Python)

Taille du jeu de données (cartes anglaises uniques) :

- **~22 000 cartes** avec image (≈ 23 000 référencées)
- Plusieurs langues, **avec une couverture inégale** (voir ci-dessous)

### Couverture multilingue (à connaître)

| Langue | Couverture des données | Périmètre V1 |
|--------|------------------------|--------------|
| Anglais (`en`) | ~99 % | ✅ **In scope V1** |
| Français (`fr`) | ~95 % | ✅ **In scope V1** |
| Japonais (`ja`) | ~42 % | ❌ Hors périmètre V1 — de nombreuses cartes renvoient `404` |

> **Périmètre V1 : français et anglais.** Le catalogue CollectionR couvre les cartes EN et FR dès
> la V1. Pour le japonais, prévoir un repli (afficher la version EN/FR) mais il reste hors périmètre
> V1.

---

## Exemple d'endpoint (métadonnées)

Récupérer une carte spécifique par son identifiant.

```
GET https://api.tcgdex.net/v2/en/cards/swsh3-20
```

Exemple de réponse (extrait réel) :

```json
{
  "id": "swsh3-20",
  "name": "Charizard VMAX",
  "rarity": "Holo Rare VMAX",
  "hp": 330,
  "types": ["Fire"],
  "set": { "id": "swsh3", "name": "Darkness Ablaze" },
  "attacks": [
    { "name": "Claw Slash", "damage": 100 }
  ],
  "image": "https://assets.tcgdex.net/en/swsh/swsh3/20"
}
```

> **Note sur les images :** le champ `image` est une **URL de base sans extension**. On y ajoute
> soi-même la qualité et le format, par exemple `.../swsh3/20/high.webp` ou `.../swsh3/20/low.png`.

---

## Récupération des prix via TCGdex

Chaque carte peut être enrichie d'un champ `pricing` agrégeant les places de marché :

```json
{
  "id": "swsh3-20",
  "name": "Charizard VMAX",
  "pricing": {
    "cardmarket": {
      "currency": "EUR",
      "trend": 18.50,
      "avg1": 18.0,
      "avg7": 18.7,
      "avg30": 19.2,
      "updated": "2026-06-14"
    },
    "tcgplayer": {
      "currency": "USD",
      "marketPrice": 21.30,
      "lowPrice": 17.00,
      "updated": "2026-06-14"
    }
  }
}
```

- **Fraîcheur** : ~horaire (TCGPlayer) à quotidienne (Cardmarket), avec un champ `updated`.
- **Sans clé API**, gratuit. C'est la **source de prix principale** de CollectionR
  (voir [marketplace-scraper.md](../marketplace/marketplace-scraper.md)).

---

## Utilisation dans le worker / backend

Le `Worker TCG API` (Python) interroge TCGdex via un client HTTP moderne, puis écrit les données
dans PostgreSQL.

Exemple en Python (`httpx`) :

```python
import httpx

async def get_card(card_id: str) -> dict:
    url = f"https://api.tcgdex.net/v2/en/cards/{card_id}"
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.get(url)
        response.raise_for_status()
        return response.json()
```

> Un **SDK Python officiel** (`tcgdex-sdk`) existe également et simplifie l'accès aux champs
> (métadonnées, images, `pricing`).

Cas d'utilisation typiques :

- Alimenter la base de cartes de référence (métadonnées + images)
- Récupérer les prix agrégés Cardmarket / TCGPlayer
- Assister le pipeline de scan (rapprochement carte détectée → fiche)

---

## Stratégie d'intégration

En production, l'architecture découple TCGdex de l'API exposée aux clients :

```
API TCGdex
    │  (Worker TCG API — Python, planifié)
    ▼
Base de données CollectionR (PostgreSQL)
    │
    ▼
Backend NestJS (adaptateur Fastify) ──▶ Clients web / mobile
```

Cela garantit :

- des requêtes plus rapides (lecture locale en base) ;
- l'indépendance vis-à-vis des APIs tierces (cache local) ;
- une meilleure fiabilité.

> Cette approche correspond exactement à la **recommandation officielle de TCGdex** : mettre les
> données en cache localement plutôt que d'interroger l'API en boucle.

---

## Licence, propriété intellectuelle et conformité

- La **base de données TCGdex** est publiée sous licence **MIT** : usage commercial, modification et
  redistribution autorisés, **à condition de conserver l'avis de licence et l'attribution**.
- **Les prix relayés ne sont PAS couverts par la MIT.** TCGdex relaie les cotes Cardmarket (EUR) et
  TCGPlayer (USD) **sans en détenir les droits** : les **CGU de Cardmarket / TCGPlayer s'appliquent
  en amont**. Métadonnées = libres (MIT) ; **prix = régime juridique distinct** (affichage à des
  tiers restreint, surtout en commercial). Voir les garde-fous CGU dans
  [marketplace-scraper.md](../marketplace/marketplace-scraper.md) (§11).
- **Important :** les **noms, images et marques Pokémon** restent la propriété de **Nintendo /
  The Pokémon Company**. La licence MIT couvre la base structurée TCGdex, **pas** les droits
  d'auteur sur les visuels et marques.
- TCGdex affiche un disclaimer explicite de **non-affiliation** à Nintendo / The Pokémon Company —
  CollectionR doit faire de même.

> **Pour un éventuel passage commercial :** faire valider par un conseil juridique la redistribution
> des **images** de cartes (zone de risque PI), distincte de la réutilisation des métadonnées.

---

## Limites et bonnes pratiques

- **Aucun rate limit dur publié**, mais l'API demande d'être « considéré » : mettre en cache et
  appliquer un back-off. CollectionR respecte ce principe via le `Worker TCG API` (synchronisation
  par lots, pas d'appels à la demande).
- Pas de tier payant : service entièrement gratuit en juin 2026.
- Version courante : **v2** (stable, pas de v3). Cibler `/v2/`.

---

## Documentation officielle

- Documentation : [https://tcgdex.dev](https://tcgdex.dev)
- Prix / markets : [https://tcgdex.dev/markets-prices](https://tcgdex.dev/markets-prices)
- Endpoint de base de l'API : [https://api.tcgdex.net](https://api.tcgdex.net)
- Dépôt de données (licence MIT) : [https://github.com/tcgdex/cards-database](https://github.com/tcgdex/cards-database)

Exemple de paramètre de langue :

```
/v2/en/cards/{id}
/v2/fr/cards/{id}
```

---

---

## Fallback prix niveau 2 : PokeTrace

PokeTrace est le **premier fallback prix** activé si TCGdex est indisponible. Il est particulièrement
utile pour maintenir les **prix EUR Cardmarket** avec une granularité par état et grade.

### PokeTrace (`https://poketrace.com`)

- **Tier gratuit : 250 requêtes/jour** — suffisant pour les synchronisations nocturnes sur un
  catalogue limité.
- **Plan Pro : 10 000 requêtes/jour** — recommandé en production ou au passage commercial.
- Données fournies :
  - **Prix EUR** (Cardmarket) + **prix USD** (TCGPlayer et eBay)
  - **Ventilation par état** : NM, LP, MP, HP, DMG…
  - **Ventilation par grade** : PSA 10, PSA 9, BGS 10, BGS 9.5, CGC 10…
  - Historique des prix
- **Clé API** stockée dans les Secrets Kubernetes (`POKETRACE_API_KEY`).
- Rôle dans la cascade : **niveau 2** — activé si TCGdex est indisponible, avant eBay Browse et
  TCGFast.

> PokeTrace est le seul fallback qui fournit nativement les **prix EUR Cardmarket avec ventilation
> par état** — ce qui en fait le complément naturel de TCGdex pour la continuité des prix EUR.

---

## Fallback prix niveau 4 : TCGFast Trader

TCGdex est interrogé en priorité (niveau 1), puis PokeTrace (niveau 2), puis eBay Browse API
(niveau 3). Si ces trois sources sont simultanément indisponibles, le `Worker TCG Fallback` active
**TCGFast Trader** (niveau 4).

### TCGFast (`https://tcgfast.com`)

- **Plan Trader à 14,99 $/mois** — usage commercial explicitement autorisé.
- Données complémentaires absentes de TCGdex :
  - Prix eBay (ventes réelles, pas seulement annonces actives)
  - **Prix gradués PSA / BGS / CGC** (marché des cartes certifiées)
  - Historique des prix
- **SDK Python disponible** — intégration simplifiée dans le worker.
- **Clé API** stockée dans les Secrets Kubernetes (`TCGFAST_API_KEY`).

> TCGFast n'est activé que si TCGdex **et** eBay Browse API sont simultanément indisponibles
> (niveau 3 de la cascade). Il constitue également la source recommandée pour le passage commercial
> (licence explicite).

---

## Sources

Vérifications web (juin 2026) :

- [TCGdex — FAQ (gratuit, sans clé)](https://tcgdex.dev/faq) · [Markets & Prices (prix Cardmarket/TCGPlayer)](https://tcgdex.dev/markets-prices) · [statut multilingue](https://api.tcgdex.net/status) · [base sous licence MIT](https://github.com/tcgdex/cards-database)
- Carte d'exemple vérifiée en direct : [`swsh3-20` — Charizard VMAX](https://api.tcgdex.net/v2/en/cards/swsh3-20)
- CGU des prix (en amont) : [Cardmarket — Conditions générales](https://www.cardmarket.com/en/Policies/GeneralTermsAndConditions) · [TCGPlayer — API Terms](https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions)
- **PokeTrace** : [https://poketrace.com](https://poketrace.com)
- **TCGFast** : [https://tcgfast.com](https://tcgfast.com)
- **eBay Browse API** : [Browse API overview](https://developer.ebay.com/api-docs/buy/browse/overview.html)
