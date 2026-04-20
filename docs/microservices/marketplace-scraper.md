# Microservice Scraper de Marketplaces

## Vue d'ensemble

Ce document décrit la conception et l'implémentation du **microservice de scraping de marketplaces** du projet Collectionr.

Son rôle est de **collecter automatiquement les prix des cartes Pokémon TCG** depuis des sites marchands externes et de les stocker en base de données.

> **Important** : ce microservice est un **worker en arrière-plan**. Il n'expose aucune API REST. Seul le backend NestJS expose des endpoints.

---

# 1. Introduction

## Pourquoi un scraper de prix ?

Les cartes Pokémon TCG ont des prix qui varient constamment selon l'offre et la demande, la rareté de la carte, son état de conservation, et la plateforme de vente.

Pour un collectionneur, connaître le **prix actuel et l'historique des prix** d'une carte est une information essentielle :

- Savoir si le moment est bon pour acheter ou vendre
- Estimer la valeur de sa collection
- Comparer les prix entre différentes plateformes

Le microservice scraper répond à ce besoin en automatisant la collecte de ces données.

## Qu'est-ce que le scraping ?

> Le **web scraping** (ou extraction de données web) est une technique qui consiste à extraire automatiquement des informations depuis des pages web ou des APIs.

Il existe deux approches principales :

1. **Via une API officielle** : le site fournit un accès programmatique à ses données (plus fiable, légal, recommandé)
2. **Via l'analyse du HTML** : on télécharge la page HTML d'un site et on extrait les données à partir de sa structure (plus fragile, à utiliser seulement si aucune API n'existe)

---

# 2. Architecture globale

## Position du scraper dans le système

Le microservice scraper est un composant **indépendant** qui s'interface avec le reste du système via la base de données et des appels HTTP.

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                         │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────────┐
│               BACKEND NESTJS                        │
│          (API principale, authentification)         │
└──────────────────────────┬──────────────────────────┘
                           │ PostgreSQL (lecture)
                           │
┌──────────────────┐    ┌──▼────────────────────────┐
│    SCRAPER       │    │     BASE DE DONNÉES        │
│  MICROSERVICE    │───▶│       PostgreSQL           │
│  (worker)        │    │ (cartes, prix, historique) │
└──────┬───────────┘    └───────────────────────────-┘
       │ Appels API officielles
       ▼
┌──────────────────────────────────────────────────────┐
│             MARKETPLACES EXTERNES                    │
│    Cardmarket API   |   eBay API   |   TCGPlayer     │
└──────────────────────────────────────────────────────┘
```

## Responsabilités du scraper

| Responsabilité             | Description                                             |
|----------------------------|---------------------------------------------------------|
| Collecte des prix          | Appeler les APIs des marketplaces selon un planning       |
| Normalisation des données  | Unifier les formats de prix, devises, états des cartes  |
| Stockage                   | Écrire les prix dans PostgreSQL                         |

> Le backend NestJS est le **seul** composant à exposer des endpoints REST. Le scraper écrit en base, le backend lit en base.

---

# 3. Marketplaces ciblées

## 3.1 Cardmarket

**Cardmarket** (anciennement MagicCardMarket) est la principale marketplace européenne de cartes à collectionner.

- **Données disponibles** : prix bas, prix moyen, prix tendance, volume de vente
- **Accès** : API REST officielle (nécessite un compte vendeur et des clés OAuth)
- **Documentation** : [https://api.cardmarket.com/ws/documentation](https://api.cardmarket.com/ws/documentation)
- **Méthode retenue** : API officielle

Exemple de requête :

```
GET https://api.cardmarket.com/ws/v2.0/products/singles/1/
Authorization: OAuth realm="..."
```

Exemple de réponse :

```json
{
  "product": {
    "idProduct": 1001,
    "enName": "Charizard",
    "priceGuide": {
      "TREND": 45.50,
      "AVG30": 43.20,
      "LOW": 30.00
    }
  }
}
```

## 3.2 eBay

**eBay** est une marketplace mondiale proposant aussi bien des ventes aux enchères que des prix fixes.

- **Données disponibles** : prix de vente, état de la carte, prix de ventes récentes
- **Accès** : API Browse (Finding API pour les ventes terminées)
- **Documentation** : [https://developer.ebay.com](https://developer.ebay.com)
- **Méthode retenue** : API officielle (Finding API)

Exemple de requête :

```
GET https://svcs.ebay.com/services/search/FindingService/v1
    ?OPERATION-NAME=findCompletedItems
    &keywords=Charizard+Pokemon+PSA+10
    &SECURITY-APPNAME=YOUR_APP_ID
```

## 3.3 TCGPlayer

**TCGPlayer** est la principale marketplace américaine pour les cartes Pokémon TCG.

- **Données disponibles** : prix du marché, prix bas, prix moyen
- **Accès** : API officielle (nécessite une clé API)
- **Documentation** : [https://docs.tcgplayer.com](https://docs.tcgplayer.com)
- **Méthode retenue** : API officielle

### Récapitulatif

| Marketplace  | Région    | Méthode d'accès  | Fiabilité |
|--------------|-----------|------------------|-----------|
| Cardmarket   | Europe    | API OAuth         | ★★★★★    |
| eBay         | Mondiale  | API Finding       | ★★★★☆    |
| TCGPlayer    | USA       | API REST          | ★★★★★    |

---

# 4. Stratégie de collecte

## 4.1 API vs Scraping HTML

Il existe deux grandes approches pour collecter des données sur le web.

### API officielle

Une **API** (Application Programming Interface) est une interface fournie par le site lui-même pour accéder à ses données de manière structurée.

```
Notre Code  ──── requête HTTP ──▶  Serveur API  ──▶  Données JSON
```

**Avantages :**
- Données structurées et fiables
- Légalement autorisé
- Résistant aux changements de design du site
- Pas de risque de blocage

**Inconvénients :**
- Nécessite une clé API (parfois payante)
- Données parfois limitées ou en retard

### Scraping HTML

Le **scraping HTML** consiste à télécharger une page web et à analyser son code HTML pour en extraire les données.

```
Notre Code  ──── requête HTTP ──▶  Serveur Web  ──▶  Page HTML brute
                                                        │
                                          Analyse du HTML (parsing)
                                                        │
                                                   Données extraites
```

**Avantages :**
- Fonctionne même sans API officielle
- Accès à toutes les données visibles

**Inconvénients :**
- Fragile : tout changement dans le HTML casse le scraper
- Peut être bloqué (anti-bot, CAPTCHA)
- Légalement ambigu selon les conditions d'utilisation du site

### Décision pour ce projet

> Pour ce projet, on privilégie **les APIs officielles** (Cardmarket, eBay, TCGPlayer).  
> Le scraping HTML est utilisé en dernier recours uniquement si aucune API n'est disponible.

---

# 5. Planification des tâches (Cron Jobs)

## Qu'est-ce qu'un cron job ?

Un **cron job** est une tâche programmée qui s'exécute automatiquement à intervalles réguliers, selon un calendrier défini.

La syntaxe d'un cron utilise 5 champs :

```
┌───── minute (0-59)
│ ┌───── heure (0-23)
│ │ ┌───── jour du mois (1-31)
│ │ │ ┌───── mois (1-12)
│ │ │ │ ┌───── jour de la semaine (0-6, 0=dimanche)
│ │ │ │ │
* * * * *  commande
```

Exemples :

| Expression   | Signification                          |
|--------------|----------------------------------------|
| `0 * * * *`  | Toutes les heures                      |
| `0 6 * * *`  | Tous les jours à 6h00                  |
| `*/30 * * *` | Toutes les 30 minutes                  |
| `0 0 * * 1`  | Tous les lundis à minuit               |

## Stratégie de planification du scraper

Pour éviter de surcharger les APIs externes et d'être bloqué, on définit des fréquences raisonnables :

```
Cartes populaires (top 100)   →  toutes les heures
Cartes standards              →  toutes les 6 heures
Cartes peu demandées          →  une fois par jour
```

## Implémentation en Python avec APScheduler

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler

scheduler = AsyncIOScheduler()

# Mise à jour des 100 cartes les plus populaires toutes les heures
@scheduler.scheduled_job("cron", minute=0)
async def scrape_popular_cards():
    await scraper_service.scrape_top_cards(limit=100)

# Mise à jour de toutes les cartes une fois par jour
@scheduler.scheduled_job("cron", hour=3, minute=0)
async def scrape_all_cards():
    await scraper_service.scrape_all()

scheduler.start()
```

> **Remarque** : on choisit 3h du matin pour le scraping complet afin de minimiser l'impact sur les serveurs externes pendant les heures de forte utilisation.

---

# 6. Modèle de données

## Tables en base de données

Le scraper utilise deux tables principales pour stocker les données de prix.

### Table `CardPrice`

Stocke le **prix actuel** d'une carte pour une marketplace donnée.

```
CardPrice
─────────────────────────
id           UUID         clé primaire
card_id      STRING       identifiant de la carte (ex: "swsh3-136")
source       STRING       marketplace source (ex: "cardmarket")
condition    STRING       état de la carte (ex: "NM", "LP", "PSA10")
currency     STRING       devise (ex: "EUR", "USD")
price        DECIMAL      prix actuel
url          STRING       lien vers l'annonce
scraped_at   TIMESTAMP    date et heure de la collecte
```

### Table `PriceHistory`

Stocke l'**historique** des prix pour analyser les tendances.

```
PriceHistory
─────────────────────────
id           UUID         clé primaire
card_id      STRING       identifiant de la carte
source       STRING       marketplace source
condition    STRING       état de la carte
currency     STRING       devise
price        DECIMAL      prix enregistré
recorded_at  TIMESTAMP    date et heure de l'enregistrement
```

## Schéma Prisma

```prisma
model CardPrice {
  id         String   @id @default(uuid())
  cardId     String
  source     String
  condition  String
  currency   String   @default("EUR")
  price      Decimal  @db.Decimal(10, 2)
  url        String?
  scrapedAt  DateTime @default(now())

  @@unique([cardId, source, condition])
  @@map("card_prices")
}

model PriceHistory {
  id         String   @id @default(uuid())
  cardId     String
  source     String
  condition  String
  currency   String   @default("EUR")
  price      Decimal  @db.Decimal(10, 2)
  recordedAt DateTime @default(now())

  @@index([cardId, source])
  @@map("price_history")
}
```

> **Remarque** : La contrainte `@@unique([cardId, source, condition])` dans `CardPrice` garantit qu'il n'existe qu'un seul prix actuel par carte, par source et par état.

---

# 7. Normalisation des données

## Pourquoi normaliser ?

Chaque marketplace a ses propres formats, conventions et terminologies. Sans normalisation, comparer des prix entre Cardmarket et eBay serait impossible.

Exemple du problème :

| Marketplace  | État de la carte | Devise | Prix  |
|--------------|-----------------|--------|-------|
| Cardmarket   | "Near Mint"     | EUR    | 45.50 |
| eBay         | "NM/Mint"       | USD    | 52.00 |
| TCGPlayer    | "Near Mint"     | USD    | 49.99 |

## 7.1 Normalisation des états (conditions)

On définit un ensemble de valeurs standardisées et une table de correspondance :

```python
# États standardisés du projet
STANDARD_CONDITIONS = ["MINT", "NM", "LP", "MP", "HP", "DMG", "PSA10", "PSA9"]

# Table de correspondance par source
CONDITION_MAP = {
    "cardmarket": {
        "Mint":        "MINT",
        "Near Mint":   "NM",
        "Excellent":   "LP",
        "Good":        "MP",
        "Light Played": "HP",
        "Played":      "DMG",
    },
    "ebay": {
        "Brand New":   "MINT",
        "NM/Mint":     "NM",
        "NM-Mint":     "NM",
        "Lightly Played": "LP",
        "Moderately Played": "MP",
        "Heavily Played": "HP",
    },
    "tcgplayer": {
        "Near Mint":   "NM",
        "Lightly Played": "LP",
        "Moderately Played": "MP",
        "Heavily Played": "HP",
        "Damaged":     "DMG",
    }
}

def normalize_condition(source: str, raw_condition: str) -> str:
    mapping = CONDITION_MAP.get(source, {})
    return mapping.get(raw_condition, "UNKNOWN")
```

## 7.2 Normalisation des devises

On convertit toutes les devises en **EUR** comme devise de référence afin de pouvoir comparer des prix entre marketplaces utilisant des devises différentes (USD pour eBay et TCGPlayer, EUR pour Cardmarket).

```python
import httpx

async def convert_to_eur(amount: float, from_currency: str) -> float:
       """Convertit un montant en EUR via une API de taux de change.

    ATTENTION : cette conversion permet de comparer des montants sur une
    devise commune, mais elle ne suffit pas à comparer deux cartes entre elles.
    La langue de la carte (EN, JP, FR) influence fortement son prix de marché :
    une même carte en japonais peut valoir bien plus ou bien moins que sa
    version anglaise ou française. Il ne faut JAMAIS fusionner les prix de
    deux cartes de langues différentes, même après conversion en EUR.
    """
    if from_currency == "EUR":
        return amount

    # Exemple avec l'API ExchangeRate (gratuite)
    response = await httpx.AsyncClient().get(
        f"https://api.exchangerate-api.com/v4/latest/{from_currency}"
    )
    rates = response.json()["rates"]
    eur_rate = rates.get("EUR", 1.0)

    return round(amount * eur_rate, 2)
```

> **Astuce** : Pour éviter trop d'appels à l'API de conversion, on peut stocker temporairement en mémoire les taux de change avec un timestamp et les rafraîchir toutes les heures.

### Limite importante : la langue de la carte

La conversion en EUR permet d'**unifier les montants**, mais elle ne dit rien sur la **valeur réelle** d'une carte sur le marché.

En pratique, la langue d'une carte est un facteur de prix à part entière :

| Carte            | Langue | Prix indicatif |
|------------------|--------|----------------|
| Charizard VMAX   | EN     | ~45 €          |
| Charizard VMAX   | JP     | ~8 €           |
| Charizard VMAX   | FR     | ~40 €          |

> Deux prix en EUR ne sont comparables que si la carte est **la même langue, le même état et la même édition**.

Pour cette raison, la langue doit être conservée dans les données stockées. Elle fait partie de l'identité d'un prix, au même titre que la source (marketplace) ou l'état (NM, LP...).

### Différence entre normalisation de devise et normalisation métier

| Type de normalisation    | Ce qu'elle fait                                      | Ce qu'elle ne fait pas                        |
|--------------------------|------------------------------------------------------|-----------------------------------------------|
| Normalisation de devise  | Convertit USD/EUR pour comparer des montants         | Ne rend pas deux cartes comparables entre elles |
| Normalisation métier     | Standardise l'état, la langue, l'édition             | Ne convertit pas les montants                 |

Les deux sont nécessaires et complémentaires. Une carte normalisée correctement doit avoir : une devise commune (EUR), un état standardisé (NM, LP...), **et une langue identifiée (EN, JP, FR)**.

## 7.3 Normalisation des noms de cartes

Les noms de cartes peuvent différer légèrement selon les sources (accents, casse, caractères spéciaux).

La normalisation consiste à :

1. Mettre le nom en **minuscules**
2. **Supprimer les accents** et caractères diacritiques
3. **Supprimer les caractères spéciaux** (tirets, parenthèses, etc.)
4. Supprimer les espaces superflus

Exemples :

| Nom brut            | Nom normalisé     |
|---------------------|-------------------|
| `"Dracaufeu"`       | `"dracaufeu"`     |
| `"Charizard-EX"`    | `"charizard ex"`  |
| `"Pikachu (Promo)"` | `"pikachu promo"` |

---

# 8. Logs et gestion des erreurs

## Pourquoi c'est important ?

Un scraper tourne en **arrière-plan**, sans intervention humaine. Si quelque chose se passe mal (site inaccessible, format de données changé, quota API dépassé), on doit pouvoir le détecter rapidement.

## 8.1 Niveaux de logs

On utilise les niveaux standards :

| Niveau    | Utilisation                                      |
|-----------|--------------------------------------------------|
| `DEBUG`   | Informations de développement (désactivé en prod)|
| `INFO`    | Événements normaux (scraping démarré, terminé)   |
| `WARNING` | Situation anormale mais non bloquante            |
| `ERROR`   | Erreur récupérable (une carte n'a pas pu être scrapée) |
| `CRITICAL`| Erreur grave (le service est inutilisable)       |

## 8.2 Configuration des logs en Python

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(),             # Affichage en console
        logging.FileHandler("scraper.log"),  # Écriture dans un fichier
    ]
)

logger = logging.getLogger("scraper")
```

## 8.3 Table de suivi des erreurs de scraping

Pour garder une trace des tentatives de scraping échouées, on ajoute une table `ScrapeLog` :

```prisma
model ScrapeLog {
  id         String   @id @default(uuid())
  cardId     String?
  source     String
  status     String   // "success" | "error" | "skipped"
  errorMsg   String?
  startedAt  DateTime @default(now())
  finishedAt DateTime?

  @@map("scrape_logs")
}
```

## 8.4 Exemple de gestion d'erreur

```python
async def scrape_card_price(card_id: str, source: str) -> None:
    log_entry = {"card_id": card_id, "source": source, "status": "error"}

    try:
        logger.info(f"Scraping {source} pour la carte {card_id}")
        price_data = await fetch_price(card_id, source)
        await save_price(price_data)

        log_entry["status"] = "success"
        logger.info(f"Prix enregistré : {price_data.price} EUR")

    except httpx.TimeoutException:
        log_entry["error_msg"] = "Timeout lors de la requête"
        logger.warning(f"Timeout pour {source} / {card_id}")

    except Exception as e:
        log_entry["error_msg"] = str(e)
        logger.error(f"Erreur inattendue pour {card_id} : {e}")

    finally:
        await save_scrape_log(log_entry)
```

---

# 9. Intégration avec le backend NestJS

## Comment le backend utilise les données du scraper

Le scraper écrit les prix dans PostgreSQL. Le backend NestJS lit directement ces données en base lorsqu'un utilisateur consulte les prix d'une carte.

> Le scraping n'est **jamais** déclenché par une requête utilisateur. Il tourne en tâche de fond, de manière périodique.

```
Client  ──▶  GET /market/{cardId}  ──▶  Backend NestJS
                                              │
                                    Lecture en base PostgreSQL
                                       (table card_prices)
                                              │
                              Données disponibles ? ──▶ OUI  ──▶ Réponse au client
                                              │
                                             NON
                                              │
                                    Retourne une réponse vide
                                    (le prochain cron job remplira)
```

## Rôles clairement séparés

| Composant             | Rôle                                                        |
|-----------------------|-------------------------------------------------------------|
| Scraper (worker)      | Collecte les prix, écrit en base, tourne en tâche de fond   |
| Backend NestJS        | Expose les endpoints, lit les données en base               |
| PostgreSQL            | Source de vérité pour tous les prix                         |
| Redis                 | Planification des jobs (BullMQ), pas de stockage de prix    |

## Endpoint côté backend

L'endpoint `GET /market/{cardId}` retourne les derniers prix disponibles pour une carte.

Si le scraper ne s'est pas encore exécuté pour cette carte, la réponse sera vide ou indiquera l'absence de données — **aucun scraping n'est déclenché à la demande**.

---

# 10. Comparaison des outils de scraping

## Panorama des outils

Quand on parle de scraping HTML (sans API officielle), il existe plusieurs bibliothèques. Voici les trois plus courantes dans l'écosystème JavaScript/TypeScript.

## Axios + Cheerio

**Axios** est une bibliothèque HTTP pour récupérer le contenu d'une page.  
**Cheerio** est une bibliothèque pour analyser et naviguer dans le HTML (similaire à jQuery).

```typescript
import axios from "axios";
import * as cheerio from "cheerio";

const { data } = await axios.get("https://exemple-market.com/card/charizard");
const $ = cheerio.load(data);

const price = $(".product-price").first().text().trim();
// → "45,50 €"
```

**Avantages :**
- Très rapide (pas de navigateur)
- Léger en mémoire
- Simple à utiliser

**Inconvénients :**
- Ne peut pas exécuter le JavaScript de la page
- Bloqué par les sites qui chargent leurs données dynamiquement

## Puppeteer

**Puppeteer** est une bibliothèque Node.js qui pilote un navigateur Chrome en mode "headless" (sans interface graphique).

```typescript
import puppeteer from "puppeteer";

const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://exemple-market.com/card/charizard");

const price = await page.$eval(".product-price", (el) => el.textContent);
await browser.close();
```

**Avantages :**
- Exécute le JavaScript de la page (données dynamiques)
- Simule un vrai navigateur (contourne certains anti-bots)

**Inconvénients :**
- Lent (doit démarrer un navigateur)
- Consomme beaucoup de mémoire
- Plus complexe à déployer

## Playwright

**Playwright** est similaire à Puppeteer, mais développé par Microsoft. Il supporte Chrome, Firefox et Safari.

```typescript
import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto("https://exemple-market.com/card/charizard");

const price = await page.locator(".product-price").textContent();
await browser.close();
```

**Avantages :**
- Multi-navigateurs (Chrome, Firefox, WebKit)
- API plus moderne et stable que Puppeteer
- Meilleure gestion des erreurs et des attentes

**Inconvénients :**
- Lent (navigateur headless)
- Plus lourd que Axios + Cheerio

## Tableau comparatif

| Critère               | Axios + Cheerio | Puppeteer      | Playwright     |
|-----------------------|-----------------|----------------|----------------|
| Vitesse               | ★★★★★           | ★★☆☆☆          | ★★☆☆☆          |
| Consommation mémoire  | ★★★★★           | ★★☆☆☆          | ★★☆☆☆          |
| JavaScript dynamique  | ✗ Non           | ✓ Oui          | ✓ Oui          |
| Facilité d'utilisation| ★★★★☆           | ★★★☆☆          | ★★★★☆          |
| Multi-navigateurs     | N/A             | Chrome uniquement | Chrome, Firefox, Safari |
| Adapté pour APIs      | ✓ Oui           | Inutile        | Inutile        |

## Choix retenu pour ce projet

> On choisit **Axios + Cheerio** pour les cas où le scraping HTML est nécessaire, car les marketplaces ciblées (Cardmarket, eBay, TCGPlayer) dispose toutes d'une **API officielle**.
>
> Axios est suffisant pour effectuer des requêtes HTTP vers ces APIs et traiter les réponses JSON. Puppeteer et Playwright seraient surdimensionnés ici.

---

# 11. Flux complet du système

Il y a deux flux distincts et **indépendants** : le flux de scraping (automatique) et le flux utilisateur (à la demande).

## Flux 1 : Scraping périodique (automatique)

Ce flux s'exécute automatiquement, sans aucune interaction utilisateur.

```
┌──────────────────────────────────┐
│         CRON JOB (1x/jour)       │  1. Déclenchement automatique planifié
└──────────────────┬───────────────┘
                   │  Job ajouté dans la queue (Redis/BullMQ)
                   ▼
┌──────────────────────────────────┐
│        SCRAPER (worker)          │  2. Récupère le job et démarre la collecte
└──────────────────┬───────────────┘
                   │  Appels vers les APIs officielles
                   ▼
┌──────────────────────────────────┐
│       MARKETPLACES EXTERNES      │  3. Retournent les données brutes
│  Cardmarket API  |  eBay API     │     (prix, état, devise)
└──────────────────┬───────────────┘
                   │  Normalisation (devise → EUR, état standardisé)
                   ▼
┌──────────────────────────────────┐
│          PostgreSQL              │  4. Écriture dans card_prices et price_history
└──────────────────────────────────┘
```

## Flux 2 : Consultation par l'utilisateur

Ce flux se déclenche lorsqu'un utilisateur consulte les prix d'une carte.

```
┌──────────┐
│  Client  │  1. Demande les prix de "swsh3-136"
└─────┬─────┘
      │  GET /market/swsh3-136
      ▼
┌─────────────────────┐
│   Backend NestJS    │  2. Lit les dernières données disponibles
│                     │     depuis PostgreSQL (table card_prices)
└──────┬──────────────┘
       │
       │  Données disponibles → retourne les prix
       │  Pas de données      → retourne une réponse vide
       ▼
┌──────────┐
│  Client  │  3. Affiche les prix (ou un message d'absence de données)
└──────────┘
```

> Le scraping n'est **jamais** déclenché lors de la consultation d'une carte. Les données affichées sont celles de la dernière exécution du cron job.

## Résumé des deux flux

| Flux         | Déclencheur          | Acteurs impliqués                          |
|--------------|----------------------|--------------------------------------------|
| Scraping     | Cron job automatique | Scraper → Marketplaces → PostgreSQL        |
| Consultation | Requête utilisateur  | Client → Backend → PostgreSQL              |

---

# Conclusion

Le microservice scraper de marketplaces est un composant clé du projet Collectionr. Il permet de :

- **Automatiser** la collecte des prix sans intervention humaine
- **Centraliser** les données de plusieurs marketplaces dans un format unifié
- **Historiser** les prix pour permettre l'analyse des tendances
- **Découpler** la logique de scraping du backend principal

En privilégiant les **APIs officielles** plutôt que le scraping HTML, on garantit une solution **fiable, stable et respectueuse des conditions d'utilisation** des plateformes tierces.

La combinaison **cron jobs + BullMQ (Redis) + PostgreSQL + NestJS** offre une architecture simple, robuste et extensible, adaptée au niveau d'un projet de fin d'études. Redis assure la planification des tâches, PostgreSQL est la source de vérité pour toutes les données de prix.
