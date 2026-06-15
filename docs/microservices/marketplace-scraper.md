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

Le microservice scraper répond à ce besoin en automatisant la collecte de ces données de manière périodique.

## Qu'est-ce que le scraping ?

> Le **web scraping** (ou extraction de données web) est une technique qui consiste à extraire automatiquement des informations depuis des pages web ou des APIs.

Il existe deux approches principales :

1. **Via une API officielle** : le site fournit un accès programmatique à ses données (plus fiable, légal, recommandé)
2. **Via l'analyse du HTML** : on télécharge la page HTML d'un site et on extrait les données à partir de sa structure (plus fragile, à utiliser seulement si aucune API n'existe)

---

# 2. Architecture globale

## Position du scraper dans le système

Le microservice scraper est un composant **indépendant**, connecté uniquement à PostgreSQL.

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
| Collecte des prix          | Appeler les APIs des marketplaces selon un planning     |
| Normalisation des données  | Unifier les formats de prix, devises, états des cartes  |
| Stockage                   | Écrire les prix dans PostgreSQL                         |

---

# 3. Marketplaces ciblées

## 3.1 Cardmarket

**Cardmarket** (anciennement MagicCardMarket) est la principale marketplace européenne de cartes à collectionner.

- **Données disponibles** : prix bas, prix moyen, prix tendance, volume de vente
- **Accès** : API REST officielle (nécessite un compte vendeur et des clés OAuth)
- **Documentation** : [https://api.cardmarket.com/ws/documentation](https://api.cardmarket.com/ws/documentation)
- **Méthode retenue** : API officielle

## 3.2 eBay

**eBay** est une marketplace mondiale proposant aussi bien des ventes aux enchères que des prix fixes.

- **Données disponibles** : prix de vente, état de la carte, prix de ventes récentes
- **Accès** : API Browse (Finding API pour les ventes terminées)
- **Documentation** : [https://developer.ebay.com](https://developer.ebay.com)
- **Méthode retenue** : API officielle (Finding API)

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
| `*/30 * * * *` | Toutes les 30 minutes                |
| `0 0 * * 1`  | Tous les lundis à minuit               |

## Stratégie de planification du scraper

Pour éviter de surcharger les APIs externes et d'être bloqué, on définit des fréquences raisonnables :

```
Cartes populaires (top 100)   →  toutes les heures
Cartes standards              →  toutes les 6 heures
Cartes peu demandées          →  une fois par jour
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
  cardPriceId     String
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

Les états standardisés du projet sont : **MINT, NM, LP, MP, HP, DMG, PSA10, PSA9**

**Cardmarket :**

| Terme source   | État normalisé |
|----------------|----------------|
| Mint           | MINT           |
| Near Mint      | NM             |
| Excellent      | LP             |
| Good           | MP             |
| Light Played   | HP             |
| Played         | DMG            |

**eBay :**

| Terme source        | État normalisé |
|---------------------|----------------|
| Brand New           | MINT           |
| NM/Mint             | NM             |
| NM-Mint             | NM             |
| Lightly Played      | LP             |
| Moderately Played   | MP             |
| Heavily Played      | HP             |

**TCGPlayer :**

| Terme source        | État normalisé |
|---------------------|----------------|
| Near Mint           | NM             |
| Lightly Played      | LP             |
| Moderately Played   | MP             |
| Heavily Played      | HP             |
| Damaged             | DMG            |

## 7.2 Normalisation des devises

On convertit toutes les devises en **EUR** comme devise de référence, afin de pouvoir comparer des prix entre marketplaces utilisant des devises différentes (USD pour eBay et TCGPlayer, EUR pour Cardmarket).

La conversion s'appuie sur une API de taux de change externe (ex : ExchangeRate API). Pour éviter trop d'appels, les taux sont conservés en mémoire et rafraîchis toutes les heures.

> **Attention** : la conversion en EUR ne suffit pas à comparer deux cartes entre elles. La langue de la carte influence fortement son prix de marché — voir la section suivante.

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

## 8.2 Table de suivi des erreurs de scraping

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

## 8.3 Comportement en cas d'erreur

Chaque tentative de scraping donne lieu à une entrée dans `ScrapeLog`, qu'elle réussisse ou échoue. En cas d'échec, le message d'erreur et le statut sont enregistrés. Le backend continue de retourner la dernière donnée disponible en base — aucune interruption de service n'est provoquée par un échec de scraping.

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

Ces bibliothèques ne sont pertinentes que si aucune API officielle n'est disponible. Pour ce projet, elles constituent un recours de dernier ressort.

| Critère               | Axios + Cheerio    | Puppeteer             | Playwright                     |
|-----------------------|--------------------|-----------------------|--------------------------------|
| Vitesse               | ★★★★★              | ★★☆☆☆                 | ★★☆☆☆                          |
| Consommation mémoire  | ★★★★★              | ★★☆☆☆                 | ★★☆☆☆                          |
| JavaScript dynamique  | ✗ Non              | ✓ Oui                 | ✓ Oui                          |
| Facilité d'utilisation| ★★★★☆              | ★★★☆☆                 | ★★★★☆                          |
| Multi-navigateurs     | N/A                | Chrome uniquement     | Chrome, Firefox, Safari        |
| Adapté pour APIs      | ✓ Oui              | Inutile               | Inutile                        |

> **Choix retenu** : Axios est suffisant pour interroger les APIs officielles (Cardmarket, eBay, TCGPlayer) et traiter les réponses JSON. Puppeteer et Playwright seraient surdimensionnés pour ce cas d'usage.

---

# 11. Flux complet du système

Il y a deux flux distincts et **indépendants** : le flux de scraping (automatique) et le flux utilisateur (à la demande).

## Flux 1 : Scraping périodique (automatique)

Ce flux s'exécute automatiquement, sans aucune interaction utilisateur.

```
┌──────────────────────────────────┐
│     CRON JOB (périodique)        │  1. Déclenchement automatique planifié
│  (1h / 6h / 24h selon la carte)  │     selon la fréquence configurée
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
└─────┬────┘
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
