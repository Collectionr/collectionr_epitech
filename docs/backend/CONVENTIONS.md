# Normes de Codage - Backend

## 📋 Vue d'ensemble

Ce document définit les règles et conventions de développement à appliquer sur le backend de l'application (**NestJS**, **TypeScript**, **Fastify**). L'objectif est de garantir une base de code uniforme, lisible et maintenable.

---

##  Architecture et Principes Fondamentaux

L'architecture repose sur la **séparation stricte des responsabilités**.

### Modularité

- L'application est divisée en **modules fonctionnels indépendants** (`@Module`)
- Chaque domaine d'application possède son propre répertoire
- La structure facilite la scalabilité et la testabilité

### Contrôleurs

- Rôle unique : **gestion du routage HTTP**
- Recevoir les requêtes
- Valider les données d'entrée
- Formater les réponses
-  La **logique métier est strictement proscrite** dans les contrôleurs

### Services

- Concentrent l'**intégralité de la logique métier**
- Orchestrent l'accès aux données
- Responsables de la manipulation des entités

### Injection de Dépendances

- L'instanciation des classes est gérée **exclusivement par le conteneur IoC (Inversion of Control)** de NestJS
- Les dépendances sont injectées via les **constructeurs**

---

##  Conventions TypeScript

Le typage strict est **obligatoire** pour assurer la fiabilité du code en amont de la compilation.

### Mode Strict

- Le compilateur TypeScript doit être configuré avec `strict: true` dans `tsconfig.json`
- Cela active tous les contrôles de type stricts possibles

### Type Any - Interdit 

- Le type `any` est **interdit**
- En cas d'incertitude structurelle, utiliser **`unknown`**
- Le type `unknown` ne peut être manipulé que **après une vérification de type** (type guard)

```typescript
//  Mauvais
function traiter(donnees: any): void {
  donnees.faire_quelquechose();
}

//  Bon
function traiter(donnees: unknown): void {
  if (typeof donnees === 'object' && donnees !== null) {
    // maintenant nous pouvons manipuler donnees
  }
}
```

### Structures de Données

- Les formes d'objets sont définies par des **interfaces** (orientation entités / données)
- Les **unions** ou **intersections** de types requièrent l'usage du mot-clé `type`

```typescript
// Pour les objets/structures de données
interface Utilisateur {
  id: string;
  nom: string;
  email: string;
}

// Pour les types complexes/unions/intersections
type Resultat = Succes | Erreur;
type Permissions = Admin & Moderateur;
```

---

##  Conventions de Nommage

La cohérence du nommage est requise pour faciliter la navigation dans le code source.

### Fichiers

Utilisation de la **casse PascalCase** pour le nom complet du fichier avec mention du type.

**Format** : `NomDuFichierType.ts`

**Exemples** :
- `CarteController.ts`
- `UtilisateurService.ts`
- `AuthenticationModule.ts`
- `CreerCarteDto.ts`
- `CarteInterface.ts`
- `CreateCarteUseCase.ts`

### Classes et Interfaces

Utilisation de la **casse PascalCase**. Le nom doit refléter le type d'objet.

**Exemples** :
- `CarteController`
- `UtilisateurService`
- `AuthenticationModule`
- `CarteInterface`

### UseCase (Pattern Clean Architecture)

Les UseCase doivent avoir un nom **explicite et descriptif** qui reflète la fonctionnalité métier qu'ils incarnent.

**Format** : `<Action><Entité>UseCase`

**Règles** :
- Commencer par un **verbe d'action** explicite (Create, Update, Delete, Find, etc.)
- Suivi du **nom de l'entité** en PascalCase
- Terminer par `UseCase`

**Exemples** :
- `CreateCarteUseCase` → créer une carte
- `UpdateUtilisateurUseCase` → mettre à jour un utilisateur
- `DeleteCollectionUseCase` → supprimer une collection
- `FindCarteByIdUseCase` → trouver une carte par ID
- `ListCartesUseCase` → lister toutes les cartes

**Pertinence** : 100% - Le nom du UseCase doit être 100% explicite sur ce qu'il fait.

### Méthodes et Variables

Utilisation de la **casse camelCase**. Les noms de méthodes doivent utiliser des **verbes d'action explicites**.

**Exemples** :
- `trouverUtilisateur()`
- `creerNouvelleCarte()`
- `mettreAJourStatut()`
- `verifierPermissions()`

```typescript
//  Bon exemple
class UtilisateurService {
  async trouverParId(id: string): Promise<Utilisateur | null> {
    return this.utilisateurRepository.findOne(id);
  }

  async creerUtilisateur(donnees: CreerUtilisateurDto): Promise<Utilisateur> {
    return this.utilisateurRepository.save(donnees);
  }
}
```

---

##  Intégration de Fastify

L'utilisation de Fastify nécessite une approche spécifique pour conserver les avantages de l'écosystème NestJS.

### Agnosticisme HTTP (Recommandé)

- Privilégier les **décorateurs standard de NestJS** :
  - `@Body()`
  - `@Query()`
  - `@Param()`
  - `@Headers()`
- Retourner **directement les objets** depuis le contrôleur
- L'application reste **indépendante du serveur HTTP** sous-jacent

### Accès Natif (Seulement si nécessaire)

L'injection directe des objets natifs Fastify (`@Req()`, `@Res()`) ne doit être effectuée que **lorsque techniquement incontournable**.

**Exigences** :
- Importer explicitement les types `FastifyRequest` et `FastifyReply`
- Documenter pourquoi cet accès direct est nécessaire
- Limiter son usage au strict minimum

```typescript
//  À éviter (sauf nécessité absolue)
@Post('upload')
async upload(@Req() req: FastifyRequest, @Res() res: FastifyReply): Promise<void> {
  // ...
}

//  Préférer cette approche
@Post()
async creer(@Body() creerDto: CreerCarteDto): Promise<Carte> {
  return this.carteService.creer(creerDto);
}
```

---

##  Modèle d'Implémentation

### Exemple : Contrôleur

```typescript
import { Controller, Get, Param, Post, Body } from '@nestjs/common';
import { CarteService } from './carte.service';
import { CreerCarteDto } from './dto/creer-carte.dto';
import { Carte } from './interfaces/carte.interface';

@Controller('cartes')
export class CarteController {
  constructor(private readonly carteService: CarteService) {}

  @Post()
  async creer(@Body() creerCarteDto: CreerCarteDto): Promise<Carte> {
    return this.carteService.creer(creerCarteDto);
  }

  @Get(':id')
  async trouverUne(@Param('id') id: string): Promise<Carte> {
    return this.carteService.trouverUne(id);
  }
}
```

### Exemple : Service

```typescript
import { Injectable } from '@nestjs/common';
import { CarteRepository } from './repositories/carte.repository';
import { CreerCarteDto } from './dto/creer-carte.dto';
import { Carte } from './interfaces/carte.interface';

@Injectable()
export class CarteService {
  constructor(private readonly carteRepository: CarteRepository) {}

  async creer(creerCarteDto: CreerCarteDto): Promise<Carte> {
    const carte = await this.carteRepository.save(creerCarteDto);
    return carte;
  }

  async trouverUne(id: string): Promise<Carte | null> {
    return this.carteRepository.findOne(id);
  }
}
```

### Exemple : DTO (Data Transfer Object)

```typescript
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreerCarteDto {
  @IsString()
  @IsNotEmpty()
  nom: string;

  @IsString()
  @IsOptional()
  description?: string;
}
```

### Exemple : Interface

```typescript
export interface Carte {
  id: string;
  nom: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

##  Checklist de Validation

Avant de soumettre une Pull Request, vérifiez que :

- [ ] Tous les types TypeScript sont explicites (pas de `any`)
- [ ] Les fichiers suivent le format `NomDuFichierType.ts` en PascalCase
- [ ] Les classes utilisant `PascalCase`, méthodes en `camelCase`
- [ ] La logique métier est dans les services, pas dans les contrôleurs
- [ ] L'injection de dépendances utilise les constructeurs
- [ ] Les interfaces sont utilisées pour les structures de données
- [ ] Les décorateurs NestJS standard sont privilégiés (`@Body()`, etc.)
- [ ] L'accès Fastify natif n'est utilisé que si nécessaire (documenté)
- [ ] Les tests unitaires couvrent la logique métier

---

##  Ressources Complémentaires

- [Documentation NestJS](https://docs.nestjs.com/)
- [TypeScript - Handbook](https://www.typescriptlang.org/docs/)
- [Fastify Documentation](https://www.fastify.io/)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)

---

**Dernière mise à jour** : Mars 2026  
**Mainteneurs** : Équipe Backend  
**Remarques** : N'hésitez pas à proposer des améliorations ! 
