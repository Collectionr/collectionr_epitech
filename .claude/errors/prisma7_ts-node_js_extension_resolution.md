# ts-node ne résout pas les imports `.js` du client Prisma généré

## Symptôme

`node -r ts-node/register prisma/seed.ts` (ou tout script ad-hoc lancé via `ts-node` classique) échoue :

```
Error: Cannot find module '../src/generated/prisma/client.js'
```

alors que le même import fonctionne dans `nest build` (compilé) et dans Jest (`moduleNameMapper`).

## Diagnostic

Le client Prisma généré (`provider = "prisma-client"`) importe ses propres modules internes avec une extension `.js` explicite sur des fichiers `.ts` — convention TypeScript NodeNext qui suppose une étape de compilation :

- `nest build` compile réellement les `.ts` en `.js` sur disque → le fichier `.js` existe physiquement, l'import fonctionne.
- Jest contourne le problème via `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` (déjà en place dans `jest.config.js`/`test/jest-e2e.json`, cf. `.claude/errors/` et ADR-010).
- `ts-node` (classique ou `--esm`) exécute le `.ts` à la volée **sans** produire de `.js` sur disque, et n'a pas d'équivalent au `moduleNameMapper` de Jest → la résolution Node échoue.

Concerne tout script exécuté hors du pipeline `nest build`/Jest — typiquement `prisma/seed.ts` (COLLR-438).

## Solution

Patcher la résolution CommonJS pour retomber sur le fichier `.ts` quand le `.js` demandé n'existe pas, via un hook `-r` chargé avant `ts-node/register` :

```js
// prisma/registerGeneratedClientResolution.js
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request.endsWith('.js') && (request.startsWith('./') || request.startsWith('../'))) {
    // ...essaie le .ts sibling si le .js n'existe pas, cf. fichier complet
  }
  return originalResolveFilename.call(this, request, parent, ...rest);
};
```

Invocation : `node -r ts-node/register -r ./prisma/registerGeneratedClientResolution.js prisma/seed.ts`.

Câblé dans `prisma.config.ts` (`migrations.seed`) et `package.json` (`prisma:seed`).

Concerne **COLLR-438** (script de seed) — à réutiliser pour tout futur script ad-hoc (autre que Jest/nest build) qui importe le client Prisma généré directement.
