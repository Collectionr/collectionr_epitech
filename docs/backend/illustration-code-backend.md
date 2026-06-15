# Illustration du Code Backend — Séparation des Couches TypeScript

Ce document illustre la séparation des responsabilités au sein du backend TypeScript du projet Collectionr.

**Stack backend :** NestJS · TypeScript · Fastify (adaptateur HTTP) · Prisma (ORM) · PostgreSQL

L'objectif est de montrer comment les flux de données transitent entre PostgreSQL, la logique métier et les requêtes HTTP, en respectant les principes de la Clean Architecture définis dans `clean-architecture.md`.

> Ce document est une **illustration pédagogique**. Il montre comment les couches s'articulent, pas l'implémentation exhaustive de chaque module.

---

## 1. La Couche Domaine (Domain Layer)

La couche domaine est le cœur du système. Elle contient les entités fondamentales du projet — cartes, collections, utilisateurs — et ne possède aucune dépendance externe : ni NestJS, ni Prisma, ni Fastify.

```typescript
// src/modules/cards/domain/entities/Card.ts

export class Card {
  constructor(
    public readonly id: string,
    public readonly setId: string,
    public readonly name: string,
    public readonly rarity: string,
    public readonly hp: number,
  ) {}
}
```

```typescript
// src/modules/cards/domain/repositories/CardRepository.ts

import { Card } from '../entities/Card';

export interface CardRepository {
  findById(id: string): Promise<Card | null>;
  findAll(): Promise<Card[]>;
}
```

**Principe :** le domaine définit des interfaces (ports) que les couches externes implémentent. La logique métier ne sait pas que Prisma existe.

---

## 2. La Couche Application (Application Layer)

Cette couche orchestre la logique métier via des cas d'utilisation (Use Cases). Elle consomme les interfaces du domaine, jamais les implémentations concrètes.

```typescript
// src/modules/cards/application/use-cases/GetCardDetailsUseCase.ts

import { Injectable } from '@nestjs/common';
import { Card } from '../../domain/entities/Card';
import { CardRepository } from '../../domain/repositories/CardRepository';

@Injectable()
export class GetCardDetailsUseCase {
  constructor(private readonly cardRepository: CardRepository) {}

  async execute(id: string): Promise<Card> {
    const card = await this.cardRepository.findById(id);

    if (!card) {
      throw new Error('CardNotFound');
    }

    return card;
  }
}
```

```typescript
// src/modules/cards/application/dtos/CardResponseDto.ts

export class CardResponseDto {
  id: string;
  name: string;
  setId: string;
  rarity: string;
  hp: number;

  static fromDomain(card: Card): CardResponseDto {
    const dto = new CardResponseDto();
    dto.id = card.id;
    dto.name = card.name;
    dto.setId = card.setId;
    dto.rarity = card.rarity;
    dto.hp = card.hp;
    return dto;
  }
}
```

**Principe :** le Use Case ne sait pas si la donnée vient de PostgreSQL, d'un cache ou d'un mock de test. Il dépend d'une interface, pas d'une implémentation.

---

## 3. La Couche Interface / Présentation (Interface Layer)

Cette couche reçoit les requêtes HTTP via NestJS et Fastify, appelle les Use Cases, et formate les réponses. Elle gère les codes de statut HTTP et la transformation des erreurs domaine en réponses HTTP.

```typescript
// src/modules/cards/interface/controllers/CarteController.ts

import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { GetCardDetailsUseCase } from '../../application/use-cases/GetCardDetailsUseCase';
import { CardResponseDto } from '../../application/dtos/CardResponseDto';

@Controller('cards')
export class CarteController {
  constructor(
    private readonly getCardDetailsUseCase: GetCardDetailsUseCase,
  ) {}

  @Get(':id')
  async trouverUne(@Param('id') id: string): Promise<CardResponseDto> {
    try {
      const card = await this.getCardDetailsUseCase.execute(id);
      return CardResponseDto.fromDomain(card);
    } catch (error) {
      if (error.message === 'CardNotFound') {
        throw new NotFoundException(`Carte ${id} introuvable`);
      }
      throw error;
    }
  }
}
```

**Principe :** le contrôleur utilise les décorateurs NestJS standard (`@Controller`, `@Get`, `@Param`). L'accès direct à Fastify via `@Req()` / `@Res()` n'est utilisé que si techniquement indispensable, et documenté explicitement.

---

## 4. La Couche Infrastructure (Infrastructure Layer)

C'est la couche la plus externe. Elle implémente les interfaces du domaine avec des technologies concrètes. C'est ici que Prisma est utilisé.

```typescript
// src/modules/cards/infrastructure/repositories/PrismaCardRepository.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../shared/infrastructure/PrismaService';
import { Card } from '../../domain/entities/Card';
import { CardRepository } from '../../domain/repositories/CardRepository';

@Injectable()
export class PrismaCardRepository implements CardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Card | null> {
    const record = await this.prisma.card.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return new Card(
      record.id,
      record.setId,
      record.name,
      record.rarity,
      record.hp,
    );
  }

  async findAll(): Promise<Card[]> {
    const records = await this.prisma.card.findMany();

    return records.map(
      (r) => new Card(r.id, r.setId, r.name, r.rarity, r.hp),
    );
  }
}
```

```typescript
// src/shared/infrastructure/PrismaService.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

**Principe :** si PostgreSQL est remplacé demain (peu probable, mais possible), seule cette couche change. Le domaine et l'application sont intacts.

---

## 5. Assemblage du Module NestJS

NestJS gère l'injection de dépendances via ses modules. C'est ici que les interfaces sont liées à leurs implémentations concrètes — l'équivalent de la Composition Root.

```typescript
// src/modules/cards/CardsModule.ts

import { Module } from '@nestjs/common';
import { CarteController } from './interface/controllers/CarteController';
import { GetCardDetailsUseCase } from './application/use-cases/GetCardDetailsUseCase';
import { PrismaCardRepository } from './infrastructure/repositories/PrismaCardRepository';
import { PrismaService } from '../../shared/infrastructure/PrismaService';

@Module({
  controllers: [CarteController],
  providers: [
    PrismaService,
    GetCardDetailsUseCase,
    {
      provide: 'CardRepository',
      useClass: PrismaCardRepository,
    },
  ],
})
export class CardsModule {}
```

**Principe :** NestJS injecte `PrismaCardRepository` partout où `CardRepository` est demandé. Le Use Case ne connaît que l'interface.

---

## 6. Configuration Fastify dans NestJS

Fastify est utilisé comme adaptateur HTTP dans NestJS, pas à la place de NestJS. La configuration se fait au point d'entrée de l'application.

```typescript
// src/main.ts

import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './AppModule';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  await app.listen(3000, '0.0.0.0');
}

bootstrap();
```

**Principe :** le reste du code (contrôleurs, services, modules) utilise les abstractions NestJS standard. Fastify est un détail d'infrastructure, pas un choix qui impacte la logique métier.

---

## 7. Flux de Données Complet

Voici le chemin d'une requête `GET /cards/:id` de bout en bout :

```
1. Requête HTTP entrante
   ↓
2. Fastify (adaptateur HTTP NestJS)
   ↓
3. CarteController — extrait l'id, appelle le Use Case
   ↓
4. GetCardDetailsUseCase — applique la logique métier
   ↓
5. CardRepository (interface) — injection de dépendance NestJS
   ↓
6. PrismaCardRepository (implémentation concrète)
   ↓
7. Prisma Client → PostgreSQL
   ↓
8. Entité Card reconstituée depuis les données brutes
   ↓
9. CardResponseDto formaté par le contrôleur
   ↓
10. Réponse JSON au client
```

---

## 8. Avantages de cette Séparation

**Testabilité :** `GetCardDetailsUseCase` peut être testé unitairement en injectant un mock de `CardRepository`, sans accès à PostgreSQL ni à NestJS.

```typescript
// Exemple de test unitaire
const mockRepo: CardRepository = {
  findById: jest.fn().mockResolvedValue(new Card('1', 'swsh3', 'Charizard', 'Rare Holo', 170)),
  findAll: jest.fn(),
};

const useCase = new GetCardDetailsUseCase(mockRepo);
const result = await useCase.execute('1');
expect(result.name).toBe('Charizard');
```

**Maintenabilité :** changer de stratégie Prisma (eager loading, select partiel, cache) ne touche que `PrismaCardRepository`.

**Indépendance technologique :** la logique métier ne dépend d'aucun framework. Si NestJS évolue ou est remplacé, le domaine et l'application restent intacts.

---

## Structure de Dossiers de Référence

```
src/
├── shared/
│   └── infrastructure/
│       └── PrismaService.ts
├── modules/
│   ├── cards/
│   │   ├── CardsModule.ts
│   │   ├── domain/
│   │   │   ├── entities/
│   │   │   │   └── Card.ts
│   │   │   └── repositories/
│   │   │       └── CardRepository.ts          ← interface (port)
│   │   ├── application/
│   │   │   ├── use-cases/
│   │   │   │   └── GetCardDetailsUseCase.ts
│   │   │   └── dtos/
│   │   │       └── CardResponseDto.ts
│   │   ├── infrastructure/
│   │   │   └── repositories/
│   │   │       └── PrismaCardRepository.ts    ← implémentation concrète
│   │   └── interface/
│   │       └── controllers/
│   │           └── CarteController.ts
│   ├── users/
│   │   └── ...
│   └── collections/
│       └── ...
├── prisma/
│   └── schema.prisma
└── main.ts
```

---

**Dernière mise à jour :** Juin 2026
**Périmètre :** Backend uniquement — `collectionr-backend`
**Documents liés :** `clean-architecture.md` · `CONVENTIONS.md`