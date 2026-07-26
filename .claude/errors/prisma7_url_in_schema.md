# Prisma 7 : erreur P1012 — `url` non supporté dans schema.prisma

## Symptôme

`npx prisma generate` échoue :

```
Error: Prisma schema validation - (get-config wasm)
Error code: P1012
error: The datasource property `url` is no longer supported in schema files.
```

## Diagnostic

Prisma 7 (≥ 7.0, constaté en 7.9) a des breaking changes majeurs vs les tutos/docs Prisma 5-6 :
- l'URL de connexion **sort du schéma** (`datasource db { provider = "postgresql" }` seulement)
- le client se connecte via un **driver adapter** passé au constructeur
- la config de Prisma Migrate vit dans `prisma.config.ts`

## Solution

```bash
npm install @prisma/client @prisma/adapter-pg && npm install -D prisma
```

```ts
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
```

Concerne **COLLR-412** (setup Prisma) — ne pas partir des exemples Prisma 5/6 trouvés en ligne.
