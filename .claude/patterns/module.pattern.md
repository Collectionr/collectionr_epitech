# Pattern — Nouveau module Clean Architecture

Modèle vivant : `src/modules/health/`. Remplacer `Carte`/`carte` par le domaine (fichiers **PascalCase**, cf. `docs/backend/conventions.md`).

## Arborescence

```
src/modules/carte/
├── CarteModule.ts
├── domain/
│   └── entities/Carte.ts                    # zéro import framework
├── application/
│   ├── ports/ICarteRepository.ts            # interface + token
│   ├── use-cases/CreateCarteUseCase.ts      # + CreateCarteUseCase.spec.ts à côté
│   └── dtos/CreateCarteDto.ts               # class-validator + @ApiProperty
├── infrastructure/
│   └── repositories/PostgresCarteRepository.ts   # implémente le port
└── interface/
    └── controllers/CarteController.ts
```

## 1. Port (application/ports/ICarteRepository.ts)

```ts
import type { Carte } from '../../domain/entities/Carte';

export const CARTE_REPOSITORY = 'CARTE_REPOSITORY';

export interface ICarteRepository {
  save(carte: Carte): Promise<Carte>;
  findById(id: string): Promise<Carte | null>;
}
```

## 2. Use case (application/use-cases/CreateCarteUseCase.ts)

```ts
import { Inject, Injectable } from '@nestjs/common';
import { CARTE_REPOSITORY } from '../ports/ICarteRepository';
import type { ICarteRepository } from '../ports/ICarteRepository';

@Injectable()
export class CreateCarteUseCase {
  constructor(@Inject(CARTE_REPOSITORY) private readonly carteRepository: ICarteRepository) {}

  async execute(/* input */): Promise<Carte> {
    // logique métier — aucune connaissance de HTTP ni de la BDD concrète
  }
}
```

## 3. DTO (application/dtos/CreateCarteDto.ts)

```ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCarteDto {
  @ApiProperty({ example: 'Pikachu' })
  @IsString()
  @IsNotEmpty()
  nom!: string;
}
```

Le ValidationPipe global (whitelist + forbidNonWhitelisted) s'applique automatiquement — ne pas re-valider dans le controller.

## 4. Controller (interface/controllers/CarteController.ts)

```ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SWAGGER_BEARER_AUTH_NAME } from '../../../../shared/bootstrap/SetupSwagger';

@ApiTags('Cartes') // tag existant : Auth | Collections | Cartes | Scan | Health
@ApiBearerAuth(SWAGGER_BEARER_AUTH_NAME) // si route protégée
@Controller('cartes') // → exposé sous /api/v1/cartes automatiquement
export class CarteController {
  constructor(private readonly createCarteUseCase: CreateCarteUseCase) {}

  @Post()
  async create(@Body() dto: CreateCarteDto): Promise<CarteResponseDto> {
    // pas de logique métier ici — délègue au use case, mappe vers le DTO de réponse
  }
}
```

Pas de gestion d'erreur locale : lever une `HttpException` NestJS (ou une erreur domaine convertie), le filtre global la formate.

## 5. Module (CarteModule.ts)

```ts
@Module({
  controllers: [CarteController],
  providers: [
    CreateCarteUseCase,
    { provide: CARTE_REPOSITORY, useClass: PostgresCarteRepository },
  ],
})
export class CarteModule {}
```

Puis l'ajouter aux `imports` de `AppModule`.

**Config du module** : pas de nombre magique en dur (timeout, taille de pool, limite…). Valeur qui varie par environnement → variable d'env dans `EnvironmentVariables.ts` + `.env.example` (défaut sûr), lue via `ConfigService`. Valeur fixe partagée entre modules → constante nommée dans `src/shared/config/AppConstants.ts`. Valeur fixe propre à un seul module → constante dans ce module (`infrastructure/` ou `domain/`), pas dans `shared`.

## 6. Tests

- **Unit** : le use case avec le port doublé (`{ save: jest.fn() }`) — à côté du fichier, `.spec.ts`.
- **e2e** : `test/<domaine>/XxxController.e2e-spec.ts` sur le modèle de `test/health/` — `Test.createTestingModule({ imports: [AppModule] })` + `await configureApp(app)` + `overrideProvider(TOKEN)` pour douber l'infra. Jamais de vraie BDD dans les tests.

## Checklist de fin

`npm run lint && npm test && npm run test:e2e && npm run build` — puis `.claude/checklists/pre_merge.md`.
