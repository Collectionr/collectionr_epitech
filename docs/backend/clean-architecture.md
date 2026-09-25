# Clean Architecture et Architecture Système - Projet Collectionr

Ce document consolide les principes de la Clean Architecture appliqués au projet Collectionr, une boîte à outils destinée aux collectionneurs de cartes TCG. Il intègre la séparation des responsabilités entre le pipeline de données et l'API principale.

## Architecture Système Globale et Séparation des Responsabilités

Le système d'information repose sur deux périmètres d'exécution distincts, articulés autour d'une base de données centralisée.

- **Le Pipeline de Données (Python)** : Ce composant asynchrone gère l'ingestion des sources externes, le nettoyage, la normalisation et l'entraînement des modèles d'intelligence artificielle. Il alimente de manière autonome la base de données PostgreSQL de référence.

- **L'API Principale (TypeScript/Fastify)** : Ce composant synchrone gère les requêtes des clients, l'authentification, les collections des utilisateurs et les decks.

- **Le Pont de Données (PostgreSQL)** : La base de données relationnelle agit comme l'interface de persistance entre le travail de préparation des données (Python) et l'exposition au client (TypeScript).

## Principes de la Clean Architecture (API TypeScript)

Malgré le couplage au niveau de la base de données partagée, l'application TypeScript applique une stricte séparation des responsabilités internes selon quatre couches concentriques.

### 1. Entités (Domaine)

Cette couche centralise la modélisation des données TCG et les règles d'entreprise fondamentales. Elle est totalement agnostique des processus de collecte exécutés par Python.

### 2. Cas d'Utilisation (Application)

Cette couche orchestre le flux de données. Elle utilise des interfaces pour lire les données de référence déposées par Python dans PostgreSQL, garantissant que le code métier TypeScript ne dépend pas des spécificités du moteur de base de données.

### 3. Adaptateurs d'Interface (Présentation)

Ces adaptateurs convertissent les données entre les cas d'utilisation et les agents externes (requêtes HTTP Fastify, requêtes SQL).

### 4. Frameworks et Pilotes (Infrastructure)

Cette couche externe contient la configuration de Fastify, la connexion à PostgreSQL et les adaptateurs permettant de communiquer avec les microservices d'intelligence artificielle Python.

## Structure de Dossiers Standard (Architecture Modulaire)

L'architecture standard utilise une organisation **modulaire par domaine métier**.

```
src/
├── shared/
│   ├── domain/
│   └── infrastructure/
├── modules/
│   ├── cards/
│   │   ├── CardsModule.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   └── dtos/
│   │   ├── infrastructure/
│   │   │   ├── repositories/
│   │   │   └── external-services/
│   │   └── interface/
│   │       ├── controllers/
│   │       ├── middlewares/
│   │       └── routes/
│   ├── users/
│   │   ├── UsersModule.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   └── repositories/
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   └── dtos/
│   │   ├── infrastructure/
│   │   │   └── repositories/
│   │   └── interface/
│   │       ├── controllers/
│   │       ├── middlewares/
│   │       └── routes/
│   └── collections/
│       ├── CollectionsModule.ts
│       ├── domain/
│       │   ├── entities/
│       │   └── repositories/
│       ├── application/
│       │   ├── use-cases/
│       │   └── dtos/
│       ├── infrastructure/
│       │   └── repositories/
│       └── interface/
│           ├── controllers/
│           ├── middlewares/
│           └── routes/
├── prisma/
│   └── migrations/
└── main.ts
```

## Justification de l'Architecture pour Collectionr

L'adoption de ce modèle architectural répond spécifiquement aux contraintes et objectifs du projet :

### Isolation du Domaine Métier

L'API TypeScript reste indépendante. Les règles de calcul de la valeur globale d'une collection ne sont pas affectées par les modifications du schéma PostgreSQL ou les mises à jour des scripts Python.

### Facilitation du Travail en Parallèle

L'équipe de 9 personnes est répartie sur plusieurs pôles (Backend, Frontend, IA/ML, DevOps, PM). La définition stricte d'interfaces permet aux développeurs de travailler simultanément sans dépendance bloquante.

### Intégration Modulaire de l'IA

Les fonctionnalités avancées telles que la détection de cartes, le pré-gradage et la prédiction de prix nécessitent des services d'inférence. L'API TypeScript effectue des appels réseau vers les points de terminaison Python (comme `/detect` ou `/grade`). Ces appels sont encapsulés dans des adaptateurs d'infrastructure, protégeant la logique métier des changements technologiques côté Python.

### Testabilité

Cette séparation garantit la possibilité de tester unitairement les cas d'utilisation de manière isolée, ce qui est indispensable pour atteindre l'objectif de couverture de tests automatisés supérieure à 70%.

## Implémentation Type : Inversion de Dépendance

Cet exemple illustre le **principe d'inversion de dépendance** (port + adaptateur) de façon générique,
avec un appel HTTP synchrone à titre pédagogique. Il ne décrit **pas** l'architecture réelle du
Worker TCG Prediction : celui-ci est un worker TCG à part entière, au même titre que Worker TCG API
et Worker TCG Scraping — il consomme la file **Redis TCG** de façon asynchrone (planification par le
Microservice TCG, cf. [marketplace-scraper.md](../microservices/marketplace/marketplace-scraper.md))
et écrit ses prédictions en base PostgreSQL, sans appel HTTP direct du backend à la demande.

```typescript
export interface AIPricePredictionService {
    estimateValue(cardId: string, attributes: Record<string, unknown>): Promise<number>;
}

export class PredictCardPriceUseCase {
    constructor(private readonly predictionService: AIPricePredictionService) {}

    async execute(cardId: string, attributes: Record<string, unknown>): Promise<number> {
        const estimatedPrice = await this.predictionService.estimateValue(cardId, attributes);
        return estimatedPrice;
    }
}

export class PythonHttpPredictionAdapter implements AIPricePredictionService {
    constructor(private readonly pythonApiUrl: string) {}

    async estimateValue(cardId: string, attributes: Record<string, unknown>): Promise<number> {
        const response = await fetch(`${this.pythonApiUrl}/predict-price`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ card_id: cardId, attributes })
        });

        if (!response.ok) {
            throw new Error("Prediction service unavailable");
        }

        const data = await response.json();
        return data.prix_estimé;
    }
}
```


TEST
