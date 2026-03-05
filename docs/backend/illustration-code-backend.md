# Illustration du Code Backend - Séparation des Couches TypeScript

Ce document technique détaille la séparation des responsabilités au sein du backend TypeScript du projet Collectionr. L'objectif est de démontrer comment les flux de données transitent entre la base de données PostgreSQL, la logique métier et les requêtes HTTP via Fastify, en respectant une isolation stricte des couches.

## 1. La Couche Domaine (Domain Layer)

La couche domaine est le cœur du système. Elle contient les entités fondamentales du projet TCG, telles que les cartes, les jeux et les collections. Elle ne possède aucune dépendance externe.

```typescript
export class Card {
    constructor(
        public readonly id: string,
        public readonly setId: string,
        public readonly name: string,
        public readonly rarity: string
    ) {}
}
```

## 2. La Couche Application (Application Layer)

Cette couche contient les cas d'utilisation. Elle orchestre la logique métier en manipulant les entités du domaine. Pour interagir avec l'extérieur (comme la base de données), elle définit des interfaces (ports) qu'elle appelle de manière agnostique. Elle ignore totalement que les données proviennent de PostgreSQL ou d'un pipeline Python en amont.

```typescript
import { Card } from "../domain/Card";

export interface CardRepository {
    findById(id: string): Promise<Card | null>;
}

export class GetCardDetailsUseCase {
    constructor(private readonly cardRepository: CardRepository) {}

    async execute(id: string): Promise<Card> {
        const card = await this.cardRepository.findById(id);
        
        if (!card) {
            throw new Error("CardNotFound");
        }
        
        return card;
    }
}
```

**Explication :** Le cas d'utilisation dépend d'une interface `CardRepository`, pas d'une implémentation concrète. Cela permet à la logique métier de rester indépendante de la technologie de persistance.

## 3. La Couche Interface / Présentation (Interface Layer)

Cette couche est responsable de la réception des requêtes des clients et du renvoi des réponses. Dans le cadre de ce projet, elle utilise le framework Fastify pour exposer les endpoints de l'API. Elle instancie les cas d'utilisation et gère les codes de statut HTTP.

```typescript
import { FastifyRequest, FastifyReply } from "fastify";
import { GetCardDetailsUseCase } from "../../application/use-cases/GetCardDetailsUseCase";

export class CardController {
    constructor(private readonly getCardDetailsUseCase: GetCardDetailsUseCase) {}

    async getCard(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply): Promise<void> {
        try {
            const card = await this.getCardDetailsUseCase.execute(request.params.id);
            reply.code(200).send(card);
        } catch (error) {
            reply.code(404).send({ error: "Card not found" });
        }
    }
}
```

**Explication :** Le contrôleur encapsule les détails de Fastify. Il transforme les données de requête HTTP pour les passer au cas d'utilisation, puis formate la réponse en JSON.

## 4. La Couche Infrastructure (Infrastructure Layer)

C'est la couche la plus externe. Elle implémente les interfaces définies par la couche application. C'est ici que se trouve le code spécifique aux outils externes, comme les requêtes SQL vers PostgreSQL ou les appels HTTP vers les microservices d'intelligence artificielle en Python.

```typescript
import { Card } from "../../domain/Card";
import { CardRepository } from "../../application/ports/CardRepository";
import { Pool } from "pg";

export class PostgresCardRepository implements CardRepository {
    constructor(private readonly dbPool: Pool) {}

    async findById(id: string): Promise<Card | null> {
        const result = await this.dbPool.query(
            "SELECT id, set_id, name, rarity FROM cards WHERE id = $1", 
            [id]
        );
        
        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return new Card(row.id, row.set_id, row.name, row.rarity);
    }
}
```

**Explication :** L'adaptateur `PostgresCardRepository` implémente l'interface `CardRepository` définie par la couche application. Il gère tous les détails de la requête SQL et la transformation des résultats en objets du domaine.

## 5. Gestion des Dépendances (Composition Root)

L'architecture impose que les couches internes ne dépendent pas des couches externes. Pour que l'application fonctionne, les implémentations concrètes de l'infrastructure doivent être injectées dans les cas d'utilisation. Ces cas d'utilisation sont ensuite injectés dans les contrôleurs.

Cette phase d'assemblage s'effectue au point d'entrée de l'application, appelé la **racine de composition** (Composition Root). Cela garantit que le reste de l'application demeure agnostique quant à la création des instances.

```typescript
import Fastify from "fastify";
import { Pool } from "pg";
import { PostgresCardRepository } from "./infrastructure/database/PostgresCardRepository";
import { GetCardDetailsUseCase } from "./application/use-cases/GetCardDetailsUseCase";
import { CardController } from "./presentation/controllers/CardController";

const server = Fastify();
const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });

const cardRepository = new PostgresCardRepository(dbPool);
const getCardDetailsUseCase = new GetCardDetailsUseCase(cardRepository);
const cardController = new CardController(getCardDetailsUseCase);

server.get("/cards/:id", (request, reply) => cardController.getCard(request, reply));

server.listen({ port: 3000 });
```

**Explication :** C'est le seul endroit où l'application connaît les implémentations concrètes. Tous les appels à `new` pour instantier les adaptateurs et les cas d'utilisation sont centralisés ici. Si vous remplacez PostgreSQL par MongoDB, seule cette fonction change.

## 6. Flux de Données

Lorsqu'un client interagit avec l'API, les données traversent les différentes couches selon un cheminement unidirectionnel et strict. Voici le cycle de vie complet d'une requête de consultation de carte :

### Requête Entrante
Le client effectue un appel HTTP sur l'URL définie. Le serveur Fastify (Infrastructure) intercepte cette requête.

### Réception par l'Interface
Le contrôleur (`CardController`) extrait les paramètres de la requête. Il invoque ensuite la méthode d'exécution du cas d'utilisation correspondant.

### Exécution de l'Application
Le cas d'utilisation (`GetCardDetailsUseCase`) applique les règles de l'application. Pour obtenir les données nécessaires, il fait appel à l'interface abstraite du dépôt (`CardRepository`). Il ignore l'origine technique des données.

### Action de l'Infrastructure
L'adaptateur concret (`PostgresCardRepository`) prend le relais. Il exécute la requête SQL appropriée via le connecteur de la base de données PostgreSQL.

### Instanciation du Domaine
L'adaptateur récupère les données brutes de la base. Il utilise ces données pour instancier une entité du domaine (`Card`). Il retourne cette entité au cas d'utilisation.

### Réponse Sortante
Le cas d'utilisation renvoie l'entité au contrôleur. Ce dernier formate la réponse finale, définit le code de statut HTTP approprié, et délègue à Fastify la transmission de la réponse JSON au client.

## Flux de Données Complet

```
1. Requête HTTP
   ↓
2. CardController (présentation)
   ↓
3. GetCardDetailsUseCase (application)
   ↓
4. CardRepository interface (injection de dépendance)
   ↓
5. PostgresCardRepository (infrastructure - implémentation concrète)
   ↓
6. Base de données PostgreSQL
   ↓
7. Réponse JSON
```

## Avantages de cette Séparation

- **Testabilité** : Vous pouvez tester `GetCardDetailsUseCase` en injectant un mock de `CardRepository` sans accéder à la base de données.
- **Maintenabilité** : Si vous remplacez PostgreSQL par une autre base de données, seule la couche infrastructure change.
- **Indépendance technologique** : La logique métier ne dépend d'aucun framework ou bibliothèque externe.
